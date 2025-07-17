export class Product {
    constructor(
        public id: string,
        public name: string,
        public price: number,
        public stock: number,
        public category: string,
        public description?: string
    ) {}

    public isInStock(): boolean {
        return this.stock > 0;
    }

    public canFulfill(quantity: number): boolean {
        return this.stock >= quantity;
    }
}
