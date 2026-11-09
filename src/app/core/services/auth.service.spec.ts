import { TestBed } from '@angular/core/testing';
import { AuthService, decodeClaims } from './auth.service';

function jwt(payload: Record<string, unknown>): string {
  const encode = (value: unknown) =>
    btoa(JSON.stringify(value)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.signature`;
}

const inOneHour = () => Math.floor(Date.now() / 1000) + 3600;

/** What the API issues after an emailed code: numeric sub, name, role "User" or "Organizer". */
const userToken = (id: number, role = 'User') => jwt({ sub: String(id), name: 'Asha Rao', role, exp: inOneHour() });

describe('decodeClaims', () => {
  it('reads user id, name, role and expiry from an API-issued token', () => {
    const claims = decodeClaims(jwt({ sub: '7', name: 'Asha', role: 'User', exp: 2000000000 }));
    expect(claims).toEqual({ userId: 7, name: 'Asha', roles: ['User'], expiresAt: 2000000000 * 1000 });
  });

  it('has no user id when sub is not numeric (dotnet user-jwts tokens)', () => {
    expect(decodeClaims(jwt({ sub: 'pavan', unique_name: 'pavan', role: 'Organizer' }))?.userId).toBeNull();
  });

  it('supports several roles and the long Microsoft role claim', () => {
    const claims = decodeClaims(
      jwt({ sub: '1', 'http://schemas.microsoft.com/ws/2008/06/identity/claims/role': ['User', 'Organizer'] }),
    );
    expect(claims?.roles).toEqual(['User', 'Organizer']);
    expect(claims?.expiresAt).toBeNull();
  });

  it('returns null for text that is not a JWT', () => {
    expect(decodeClaims('not-a-token')).toBeNull();
    expect(decodeClaims('a.b.c')).toBeNull();
  });
});

describe('AuthService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
  });

  it('starts a session from the API token, exposes the user and persists it', () => {
    const auth = TestBed.inject(AuthService);
    const token = userToken(7);

    expect(auth.startSession(token)).toBeNull();

    expect(auth.isSignedIn()).toBe(true);
    expect(auth.userId()).toBe(7);
    expect(auth.displayName()).toBe('Asha Rao');
    expect(auth.isAdmin()).toBe(false);
    expect(auth.getToken()).toBe(token);
    expect(localStorage.getItem('sporttracker.token')).toBe(token);
  });

  it('restores a stored session on startup', () => {
    localStorage.setItem('sporttracker.token', userToken(9));
    expect(TestBed.inject(AuthService).userId()).toBe(9);
  });

  it('rejects unreadable and expired tokens', () => {
    const auth = TestBed.inject(AuthService);

    expect(auth.startSession('hello')).toMatch(/could not be read/);
    expect(auth.startSession(jwt({ sub: '1', role: 'User', exp: 1000 }))).toMatch(/expired/);
    expect(auth.isSignedIn()).toBe(false);
  });

  it('lets a tournament organizer manage their own tournament only', () => {
    const auth = TestBed.inject(AuthService);
    auth.startSession(userToken(7));

    expect(auth.canManage(7)).toBe(true);
    expect(auth.canManage(8)).toBe(false);
    expect(auth.canManage(null)).toBe(false);
    expect(auth.canManage(undefined)).toBe(false);
  });

  it('lets a site admin manage every tournament, including ones with no owner', () => {
    const auth = TestBed.inject(AuthService);
    auth.startSession(userToken(1, 'Organizer'));

    expect(auth.isAdmin()).toBe(true);
    expect(auth.canManage(8)).toBe(true);
    expect(auth.canManage(null)).toBe(true);
  });

  it('lets nobody manage anything when signed out', () => {
    const auth = TestBed.inject(AuthService);

    expect(auth.canManage(7)).toBe(false);
    expect(auth.canManage(null)).toBe(false);
  });

  it('a token without a numeric sub is signed in but owns nothing', () => {
    const auth = TestBed.inject(AuthService);
    auth.startSession(jwt({ sub: 'pavan', role: 'User', exp: inOneHour() }));

    expect(auth.isSignedIn()).toBe(true);
    expect(auth.canManage(7)).toBe(false);
  });

  it('shows a renamed display name until the next sign-in', () => {
    const auth = TestBed.inject(AuthService);
    auth.startSession(userToken(7));

    auth.setDisplayName('Asha R.');
    expect(auth.displayName()).toBe('Asha R.');

    auth.signOut();
    expect(auth.displayName()).toBe('');
  });

  it('forgets the token on sign out', () => {
    const auth = TestBed.inject(AuthService);
    auth.startSession(userToken(7));

    auth.signOut();

    expect(auth.isSignedIn()).toBe(false);
    expect(auth.getToken()).toBeNull();
    expect(localStorage.getItem('sporttracker.token')).toBeNull();
  });
});
