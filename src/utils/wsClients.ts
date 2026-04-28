import { User } from './user';

export default class WsClients {
    private static instance: WsClients;
    private data: Map<string, User>;
    private constructor() {
        this.data = new Map<string, User>();
    }

    public add(id: string, client: User) {
        return this.data.set(id, client);
    }

    public get(id: string) {
        return this.data.get(id);
    }

    public delete(id: string) {
        // Be forgiving on disconnect races; nothing else relies on the throw.
        this.data.delete(id);
    }

    public static getInstance() {
        if (!this.instance) {
            this.instance = new WsClients();
        }
        return this.instance;
    }
}
