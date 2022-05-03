import algosdk from "algosdk";
import { APP_ID, REGISTRATION_PRICE, TRANSFER_FEE } from "../constants";
import { generateTeal } from "./generateTeal";

export class Transactions {
  private algodClient: any;
  
  constructor(client?: any) {
    this.algodClient = client;
  }

  async generateLsig (name: string) {
    const client = this.algodClient;
    let program = await client.compile(generateTeal(name)).do();
    program = new Uint8Array(Buffer.from(program.result, "base64"));

    return new algosdk.LogicSigAccount(program);
  }

  async prepareNameRegistrationTransactions (
    name: string,
    address: string,
    period: number
  ) {
    const algodClient = this.algodClient;

    /* 1st Txn - Payment to Smart Contract */

    let amount = 0;
    const lsig = await this.generateLsig(name);
    const params = await algodClient.getTransactionParams().do();

    params.fee = 1000;
    params.flatFee = true;

    let receiver = algosdk.getApplicationAddress(APP_ID);
    let sender = address;

    if (period === undefined) period = 0;
    else period--;

    if (name.length < 3) return;
    else if (name.length === 3)
      amount = REGISTRATION_PRICE.CHAR_3_AMOUNT + period * REGISTRATION_PRICE.CHAR_3_AMOUNT;
    else if (name.length === 4)
      amount = REGISTRATION_PRICE.CHAR_4_AMOUNT + period * REGISTRATION_PRICE.CHAR_4_AMOUNT;
    else if (name.length >= 5)
      amount = REGISTRATION_PRICE.CHAR_5_AMOUNT + period * REGISTRATION_PRICE.CHAR_5_AMOUNT;

    const closeToRemaninder = undefined;
    const note = undefined;

    const txn1 = algosdk.makePaymentTxnWithSuggestedParams(
      sender,
      receiver,
      amount,
      closeToRemaninder,
      note,
      params
    );

    const groupTxns = [];
    groupTxns.push(txn1);

    /* 2nd Txn - Funding Lsig */

    sender = address;
    receiver = lsig.address();
    amount = 915000;

    const txn2 = algosdk.makePaymentTxnWithSuggestedParams(
      sender,
      receiver,
      amount,
      closeToRemaninder,
      note,
      params
    );

    groupTxns.push(txn2);

    /* 3rd Txn - Optin to App from Lsig */

    const txn3 = await algosdk.makeApplicationOptInTxnFromObject({
      from: lsig.address(),
      suggestedParams: params,
      appIndex: APP_ID,
    });

    groupTxns.push(txn3);

    sender = lsig.address();
    receiver = address;
    amount = 0;

    /* 4th Txn - Account registers name */

    const method = "register_name";

    const appArgs = [];

    period++;

    appArgs.push(new Uint8Array(Buffer.from(method)));
    appArgs.push(new Uint8Array(Buffer.from(name)));
    appArgs.push(algosdk.encodeUint64(period));
    const txn4 = await algosdk.makeApplicationNoOpTxn(
      address,
      params,
      APP_ID,
      appArgs,
      [lsig.address()]
    );
    groupTxns.push(txn4);

    algosdk.assignGroupID(groupTxns);

    const signedOptinTxn = algosdk.signLogicSigTransaction(groupTxns[2], lsig);

    return {
      optinTxn: signedOptinTxn,
      txns: groupTxns,
      unsignedOptinTxn: groupTxns[2],
    };
  }

  async prepareUpdateNamePropertyTransactions (
    name: string,
    address: string,
    editedHandles: any
  ) {
    const algodClient = this.algodClient;

    const lsig = await this.generateLsig(name);
    const params = await algodClient.getTransactionParams().do();
    params.fee = 1000;
    params.flatFee = true;

    const method = "update_name";

    const groupTxns = [];

    for (const key in editedHandles) {
      const appArgs = [];
      const network = key;
      const handle = editedHandles[key];

      appArgs.push(new Uint8Array(Buffer.from(method)));
      appArgs.push(new Uint8Array(Buffer.from(network)));
      appArgs.push(new Uint8Array(Buffer.from(handle)));

      const txn = await algosdk.makeApplicationNoOpTxn(
        address,
        params,
        APP_ID,
        appArgs,
        [lsig.address()]
      );
      groupTxns.push(txn);
    }

    if (Object.keys(editedHandles).length > 1) algosdk.assignGroupID(groupTxns);

    return groupTxns;
  }

  async preparePaymentTxn (
    sender: string,
    receiver: string,
    amt: number,
    note?: any
  ) {
    const algodClient = this.algodClient;
    const params = await algodClient.getTransactionParams().do();
    amt = algosdk.algosToMicroalgos(amt);
    const enc = new TextEncoder();
    note = enc.encode(note);
    const closeToRemaninder = undefined;

    const txn = algosdk.makePaymentTxnWithSuggestedParams(
      sender,
      receiver,
      amt,
      closeToRemaninder,
      note,
      params
    );

    return txn;
  }

  async prepareNameRenewalTxns (
    name: string,
    sender: string,
    years: number,
    amt: number
  ) {
    name = name.split(".algo")[0];
    const algodClient = this.algodClient;
    const params = await algodClient.getTransactionParams().do();
    const receiver = algosdk.getApplicationAddress(APP_ID);
    const closeToRemaninder = undefined;
    const note = undefined;
    const paymentTxn = algosdk.makePaymentTxnWithSuggestedParams(
      sender,
      receiver,
      amt,
      closeToRemaninder,
      note,
      params
    );

    const lsig = await this.generateLsig(name);

    const appArgs = [];
    appArgs.push(new Uint8Array(Buffer.from("renew_name")));
    appArgs.push(algosdk.encodeUint64(years));

    const applicationTxn = algosdk.makeApplicationNoOpTxn(
      sender,
      params,
      APP_ID,
      appArgs,
      [lsig.address()]
    );

    algosdk.assignGroupID([paymentTxn, applicationTxn]);

    const groupTxns = [paymentTxn, applicationTxn];
    return groupTxns;
  }

  async prepareInitiateNameTransferTransaction (
    name: string,
    sender: string,
    newOwner: string,
    price: number
  ) {
    const algodClient = this.algodClient;
    price = algosdk.algosToMicroalgos(price);
    const params = await algodClient.getTransactionParams().do();
    name = name.split(".algo")[0];

    const lsig = await this.generateLsig(name);

    const appArgs = [];
    appArgs.push(new Uint8Array(Buffer.from("initiate_transfer")));
    appArgs.push(algosdk.encodeUint64(price));

    const applicationTxn = algosdk.makeApplicationNoOpTxn(
      sender,
      params,
      APP_ID,
      appArgs,
      [lsig.address(), newOwner]
    );
    return applicationTxn;
  }

  async prepareAcceptNameTransferTransactions (
    name: string,
    sender: string,
    receiver: string,
    amt: number
  ) {
    amt = algosdk.algosToMicroalgos(amt);
    const algodClient = this.algodClient;
    const params = await algodClient.getTransactionParams().do();

    const closeToRemaninder = undefined;
    const note = undefined;
    const paymentToOwnerTxn = algosdk.makePaymentTxnWithSuggestedParams(
      sender,
      receiver,
      amt,
      closeToRemaninder,
      note,
      params
    );

    receiver = algosdk.getApplicationAddress(APP_ID);

    const paymentToSmartContractTxn = algosdk.makePaymentTxnWithSuggestedParams(
      sender,
      receiver,
      TRANSFER_FEE,
      closeToRemaninder,
      note,
      params
    );

    name = name.split(".algo")[0];

    const lsig = await this.generateLsig(name);

    const appArgs = [];
    appArgs.push(new Uint8Array(Buffer.from("accept_transfer")));

    const applicationTxn = algosdk.makeApplicationNoOpTxn(
      sender,
      params,
      APP_ID,
      appArgs,
      [lsig.address()]
    );

    algosdk.assignGroupID([
      paymentToOwnerTxn,
      paymentToSmartContractTxn,
      applicationTxn,
    ]);

    const groupTxns = [
      paymentToOwnerTxn,
      paymentToSmartContractTxn,
      applicationTxn,
    ];
    return groupTxns;
  }
}
