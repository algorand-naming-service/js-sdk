import { Resolver } from "./resolver.js";
import { Transactions } from "./transactions.js";
import { AddressValidationError, IncorrectOwnerError, NameNotRegisteredError, } from "./errors.js";
import { isValidAddress } from "./validation.js";
export class Name {
    constructor(options) {
        const { name, rpc, indexer } = options;
        this.name = name;
        this.resolver = new Resolver(rpc, indexer, name);
        this.transactions = new Transactions(rpc, indexer, name);
    }
    async isRegistered() {
        const status = await this.resolver.resolveName();
        return status.found;
    }
    async getOwner() {
        return await this.resolver.owner();
    }
    async getContent() {
        return await this.resolver.content();
    }
    async getText(key) {
        return await this.resolver.text(key);
    }
    async getAllInformation() {
        return await this.resolver.resolveName();
    }
    async getExpiry() {
        return await this.resolver.expiry();
    }
    async isValidTransaction(sender, receiver, method) {
        if (!(await this.isRegistered())) {
            throw new NameNotRegisteredError(this.name);
        }
        if (!isValidAddress(sender)) {
            throw new AddressValidationError();
        }
        if (receiver) {
            if (!isValidAddress(receiver))
                throw new AddressValidationError();
        }
        const owner = await this.getOwner();
        if (!(await isValidAddress(sender))) {
            throw new AddressValidationError();
        }
        if (!receiver && !method) {
            if (owner !== sender) {
                throw new IncorrectOwnerError(this.name, sender);
            }
        }
        else if (sender && receiver) {
            if (method === "initiate_transfer") {
                if (owner !== sender) {
                    throw new IncorrectOwnerError(this.name, sender);
                }
            }
            else if (method === "accept_transfer") {
                if (owner !== receiver) {
                    throw new IncorrectOwnerError(this.name, receiver);
                }
            }
        }
        return true;
    }
    async register(address, period) {
        if (await this.isRegistered()) {
            throw new Error("Name already registered");
        }
        if (!isValidAddress(address)) {
            throw new AddressValidationError();
        }
        else {
            return await this.transactions.prepareNameRegistrationTransactions(address, period);
        }
    }
    async update(address, editedHandles) {
        await this.isValidTransaction(address);
        return await this.transactions.prepareUpdateNamePropertyTransactions(address, editedHandles);
    }
    async renew(address, years) {
        await this.isValidTransaction(address);
        return await this.transactions.prepareNameRenewalTxns(address, years);
    }
    async initTransfer(owner, newOwner, price) {
        await this.isValidTransaction(owner, newOwner, "initiate_transfer");
        return await this.transactions.prepareInitiateNameTransferTransaction(owner, newOwner, price);
    }
    async acceptTransfer(newOwner, owner, price) {
        await this.isValidTransaction(newOwner, owner, "accept_transfer");
        return await this.transactions.prepareAcceptNameTransferTransactions(newOwner, owner, price);
    }
}
