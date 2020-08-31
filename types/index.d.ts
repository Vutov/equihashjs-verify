export declare interface Network {
    n: number;
    k: number;
    person: string;
}

/**
 * Equihash validator.
 */
export declare class Equihash {
    constructor(network?: Network);
    verify(header: Buffer, solution: Buffer, nonce?: Buffer): boolean;
}

/**
 * Supported default networks.
 */
export declare const networks: {[name: string]: Network};