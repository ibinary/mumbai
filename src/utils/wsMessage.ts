export default class WSMessage<T = unknown> {
    public type: string;
    public message: T;

    constructor(type: string, message: T) {
        this.type = type;
        this.message = message;
    }
}
