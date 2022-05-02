import { Resolver } from "./classes/resolver";
import { Transactions } from "./classes/transactions";
import { CONSTANTS } from "./constants";
import algosdk from "algosdk";
import {
  AddressValidationError,
  IncorrectOwnerError,
  InvalidNameError,
  NameNotRegisteredError,
} from "./classes/errors";

export class AnsResolver {
  private resolverInstance: any;
  private transactionsInstance: any;

  constructor(client: any, indexer: any) {
    this.resolverInstance = new Resolver(client, indexer);
    this.transactionsInstance = new Transactions(client);
  }

  async isValidAddress (address: string){
    return algosdk.isValidAddress(address);
  }

  async isValidName (name: any) {
    name = name.split(".algo")[0];
    const lengthOfName = name.length;
    for (let i = 0; i < lengthOfName; i++) {
      if (
        !(
          name.charCodeAt(i) >= CONSTANTS.ASCII_0 &&
          name.charCodeAt(i) <= CONSTANTS.ASCII_9
        )
      ) {
        if (
          !(
            name.charCodeAt(i) >= CONSTANTS.ASCII_A &&
            name.charCodeAt(i) <= CONSTANTS.ASCII_Z
          )
        )
          throw new InvalidNameError();
      }
    }
    return true;
  }

  async isValidTransaction (
    name: string,
    sender: string,
    receiver?: string,
    method?: string
  ) {
    name = name.split(".algo")[0];
    if (!(await this.isValidName(name))) return;
    if (!(await this.isValidAddress(sender)))
      throw new AddressValidationError();
    if (!receiver && !method) {
      const nameInfo: any = await this.resolveName(name);
      if (nameInfo["found"]) {
        if (nameInfo["address"] !== sender)
          throw new IncorrectOwnerError(name, sender);
      }
    } else if (sender && receiver) {
      if (method === "initiate_transfer") {
        const nameInfo: any = await this.resolveName(name);
        if (nameInfo["found"]) {
          if (nameInfo["address"] !== sender)
            throw new IncorrectOwnerError(name, sender);
        }
      } else if (method === "accept_transfer") {
        const nameInfo: any = await this.resolveName(name);
        if (nameInfo["found"]) {
          if (nameInfo["address"] !== receiver)
            throw new IncorrectOwnerError(name, sender);
        }
      }
    }
    return true;
  }

  async resolveName (name: string) {
    if (!(await this.isValidName(name))) return;
    const nameInfo = await this.resolverInstance.resolveName(name);
    return nameInfo;
  }

  async getNamesOwnedByAddress (
    account: string,
    socials?: boolean,
    metadata?: boolean,
    limit?: number
  ) {
    if (!(await this.isValidAddress(account)))
      throw new AddressValidationError();
    const accountInfo = await this.resolverInstance.getNamesOwnedByAddress(
      account,
      socials,
      metadata,
      limit
    );
    return accountInfo;
  }

  async prepareNameRegistrationTransactions (
    name: string,
    address: string,
    period: number
  ) {
    await this.isValidName(name);
    if (!(await this.isValidAddress(address)))
      throw new AddressValidationError();
    const nameInfo: any = await this.resolveName(name);
    if (nameInfo["found"]) throw new Error("Name already registered");
    try {
      const txns =
        await this.transactionsInstance.prepareNameRegistrationTransactions(
          name,
          address,
          period
        );
      return txns;
    } catch (err: any) {
      return err.message;
    }
  }

  async prepareUpdateNamePropertyTransactions(
    name: string,
    address: string,
    editedHandles: any
  ) {
    await this.isValidTransaction(name, address);
    const nameInfo: any = await this.resolveName(name);
    if (!nameInfo["found"]) throw new NameNotRegisteredError(name);
    try {
      const txns =
        await this.transactionsInstance.prepareUpdateNamePropertyTransactions(
          name,
          address,
          editedHandles
        );
      return txns;
    } catch (err: any) {
      return err.message;
    }
  }

  async preparePaymentTxn (
    sender: string,
    receiver: string,
    amt: number,
    note?: any
  ) {
    try {
      const txns = await this.transactionsInstance.preparePaymentTxn(
        sender,
        receiver,
        amt,
        note
      );
      return txns;
    } catch (err: any) {
      return err.message;
    }
  }

  async prepareNameRenewalTransactions (
    name: string,
    sender: string,
    years: number
  ){
    await this.isValidTransaction(name, sender);
    const nameInfo: any = await this.resolveName(name);
    if (!nameInfo["found"]) throw new NameNotRegisteredError(name);
    try {
      let amt = 0;
      name = name.split(".algo")[0];
      if (name.length < 3) return;
      if (name.length === 3) amt = CONSTANTS.CHAR_3_AMOUNT * years;
      else if (name.length === 4) amt = CONSTANTS.CHAR_4_AMOUNT * years;
      else if (name.length >= 5) amt = CONSTANTS.CHAR_5_AMOUNT * years;
      const txns = await this.transactionsInstance.prepareNameRenewalTxns(
        name,
        sender,
        years,
        amt
      );
      return txns;
    } catch (err: any) {
      return err.message;
    }
  }

  async prepareInitiateNameTransferTransaction (
    name: string,
    sender: string,
    newOwner: string,
    price: number
  ) {
    await this.isValidTransaction(name, sender, newOwner, "initiate_transfer");
    const nameInfo: any = await this.resolveName(name);
    if (!nameInfo["found"]) throw new NameNotRegisteredError(name);
    try {
      const txns =
        await this.transactionsInstance.prepareInitiateNameTransferTransaction(
          name,
          sender,
          newOwner,
          price
        );
      return txns;
    } catch (err: any) {
      return err.message;
    }
  }

  async prepareAcceptNameTransferTransactions (
    name: string,
    sender: string,
    receiver: string,
    amt: number
  ) {
    await this.isValidTransaction(name, sender, receiver, "accept_transfer");
    const nameInfo: any = await this.resolveName(name);
    if (!nameInfo["found"]) throw new NameNotRegisteredError(name);
    try {
      const txns =
        await this.transactionsInstance.prepareAcceptNameTransferTransactions(
          name,
          sender,
          receiver,
          amt
        );
      return txns;
    } catch (err: any) {
      return err.message;
    }
  }
}
