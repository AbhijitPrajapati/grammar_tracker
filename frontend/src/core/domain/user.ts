export type UserId = string;

export class EmailAddress {
  readonly value: string;

  constructor(value: string) {
    const normalized = value.trim().toLowerCase();
    const separator = normalized.indexOf("@");
    const local = normalized.slice(0, separator);
    const domain = normalized.slice(separator + 1);

    if (separator < 0 || local.length === 0 || !domain.includes(".")) {
      throw new TypeError("Invalid email address");
    }

    this.value = normalized;
    Object.freeze(this);
  }

  toString(): string {
    return this.value;
  }
}

export class NewPassword {
  static readonly MIN_LENGTH = 8;
  static readonly MAX_LENGTH = 128;

  readonly value: string;

  constructor(value: string) {
    const length = Array.from(value).length;
    if (length < NewPassword.MIN_LENGTH || length > NewPassword.MAX_LENGTH) {
      throw new RangeError(
        `Password must be between ${NewPassword.MIN_LENGTH} and ${NewPassword.MAX_LENGTH} characters`,
      );
    }

    this.value = value;
    Object.freeze(this);
  }
}

export interface UserAccountProperties {
  readonly id: UserId;
  readonly email: EmailAddress;
  readonly createdAt: Date;
}

/** Public account state. Credential material deliberately stays outside the domain. */
export class UserAccount implements UserAccountProperties {
  readonly id: UserId;
  readonly email: EmailAddress;
  readonly createdAt: Date;

  constructor(properties: UserAccountProperties) {
    this.id = properties.id;
    this.email = properties.email;
    this.createdAt = new Date(properties.createdAt);
    Object.freeze(this);
  }
}

export interface StoredUser {
  readonly account: UserAccount;
  readonly passwordHash: string;
}

export class EmailConflictError extends Error {
  constructor(
    message = "Normalized email already exists",
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "EmailConflictError";
  }
}

/** Domain-owned persistence port for user accounts and credentials. */
export interface UserRepository {
  /** May throw EmailConflictError after a concurrent uniqueness collision. */
  create(email: EmailAddress, passwordHash: string): Promise<StoredUser>;
  getById(userId: UserId): Promise<StoredUser | null>;
  getByEmail(email: EmailAddress): Promise<StoredUser | null>;
  delete(userId: UserId): Promise<boolean>;
  updatePassword(
    userId: UserId,
    passwordHash: string,
  ): Promise<StoredUser | null>;
}
