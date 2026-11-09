import { Injectable, computed, signal } from '@angular/core';

const STORAGE_KEY = 'sporttracker.token';
/** Role claim for site-wide admins. Ordinary users carry the role "User" and organize only what they create. */
const ADMIN_ROLE = 'Organizer';
const ROLE_CLAIMS = ['role', 'roles', 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'];
const NAME_CLAIMS = ['name', 'unique_name', 'preferred_username'];

export interface TokenClaims {
  /** Numeric `sub`: the user id. Null for tokens that do not carry one (such as `dotnet user-jwts` tokens). */
  userId: number | null;
  name: string;
  roles: string[];
  /** Expiry as epoch milliseconds, or null when the token has no `exp`. */
  expiresAt: number | null;
}

/**
 * Holds the signed-in user's access token (issued by the API after an emailed one-time code).
 * What this class says about permissions only drives the UI; the backend enforces them on every
 * request (`Tournament.Forbidden`, `Auth.Required`).
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly token = signal<string | null>(readStoredToken());

  readonly claims = computed(() => {
    const token = this.token();
    return token ? decodeClaims(token) : null;
  });

  readonly isSignedIn = computed(() => {
    const claims = this.claims();
    return claims !== null && (claims.expiresAt === null || claims.expiresAt > Date.now());
  });

  /** A site-wide admin (role "Organizer"): may manage every tournament, including ones with no owner. */
  readonly isAdmin = computed(() => this.isSignedIn() && (this.claims()?.roles.includes(ADMIN_ROLE) ?? false));

  readonly userId = computed(() => (this.isSignedIn() ? (this.claims()?.userId ?? null) : null));

  /** Set after the person renames themself, so the header is right before the next sign-in refreshes the token. */
  private readonly nameOverride = signal<string | null>(null);

  readonly displayName = computed(() => this.nameOverride() ?? this.claims()?.name ?? '');

  setDisplayName(name: string): void {
    this.nameOverride.set(name);
  }

  /**
   * May the current user change this tournament? True for its organizer and for site admins.
   * Pass the tournament's `organizerUserId` (null when it has no owner).
   */
  canManage(organizerUserId: number | null | undefined): boolean {
    if (this.isAdmin()) {
      return true;
    }
    const me = this.userId();
    return me !== null && organizerUserId !== null && organizerUserId !== undefined && organizerUserId === me;
  }

  /** The raw token for the Authorization header, or null when signed out or expired. */
  getToken(): string | null {
    return this.isSignedIn() ? this.token() : null;
  }

  /** Starts a session from the access token returned by `POST /api/auth/otp/verify`. Returns an error message, or null on success. */
  startSession(accessToken: string): string | null {
    const token = accessToken.trim();
    const claims = token ? decodeClaims(token) : null;

    if (!claims) {
      return 'The server returned a sign-in token that could not be read.';
    }
    if (claims.expiresAt !== null && claims.expiresAt <= Date.now()) {
      return 'The sign-in token has already expired. Check that your device clock is correct.';
    }

    this.nameOverride.set(null);
    this.token.set(token);
    writeStoredToken(token);
    return null;
  }

  signOut(): void {
    this.nameOverride.set(null);
    this.token.set(null);
    writeStoredToken(null);
  }
}

export function decodeClaims(token: string): TokenClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;

    const roles = ROLE_CLAIMS.flatMap((key) => {
      const value = payload[key];
      return Array.isArray(value) ? value.map(String) : value !== undefined ? [String(value)] : [];
    });
    const nameClaim = NAME_CLAIMS.find((key) => typeof payload[key] === 'string');
    const exp = payload['exp'];
    const sub = payload['sub'];
    const userId = typeof sub === 'string' && /^\d+$/.test(sub) ? Number(sub) : typeof sub === 'number' ? sub : null;

    return {
      userId,
      name: nameClaim ? String(payload[nameClaim]) : 'Signed in',
      roles,
      expiresAt: typeof exp === 'number' ? exp * 1000 : null,
    };
  } catch {
    return null;
  }
}

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(STORAGE_KEY, token);
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage can be unavailable (private mode); the session then lasts until reload.
  }
}
