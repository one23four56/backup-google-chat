/**
 * Simple class that allows for listening for data changes, allowing basic 
 * state management
 */
export default class ReactiveContainer<type> {
    private _data: type; // actual data stored here
    private listeners: [symbol, (data: type) => void][] = [];

    /**
     * creates a reactive data container
     * @param data initial data to use
     */
    constructor(data: type) {
        this._data = data;
    }

    /**
     * The current state
     */
    get data(): type {
        return this._data;
    }

    /**
     * Change the state and activate listeners
     */
    set data(data: type) {
        this._data = data;

        for (const [_s, listener] of this.listeners)
            listener(data);
    }

    /**
     * Fires the change event on demand  
     * *Note: this does **NOT** change data, only use if no actual data was changed*
     */
    syntheticChange() {
        for (const [_s, listener] of this.listeners)
            listener(this._data);
    }

    /**
     * The given callback function will be called on state change
     * @param callback Function that will be called on state change
     * @returns A function that can be called to remove the listener
     */
    onChange(callback: (data: type) => void): () => void {

        const symbol = Symbol();

        this.listeners.push([symbol, callback]);

        return () => this.listeners = this.listeners.filter(([s]) => s !== symbol);

    }
}
