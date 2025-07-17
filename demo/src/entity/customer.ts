export class Customer {
    constructor(
        public id: string,
        public name: string,
        public email: string,
        public phone?: string,
        public address?: string,
        public createdAt: Date = new Date()
    ) {}

    public isValidEmail(): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(this.email);
    }

    public getDisplayName(): string {
        return this.name || this.email;
    }
}
