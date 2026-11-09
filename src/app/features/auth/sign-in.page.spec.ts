import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { errorInterceptor } from '../../core/interceptors/error.interceptor';
import { AuthService } from '../../core/services/auth.service';
import { SignInPage, looseEmail } from './sign-in.page';
import { FormControl } from '@angular/forms';

function jwt(payload: Record<string, unknown>): string {
  const part = (v: unknown) => btoa(JSON.stringify(v)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${part({ alg: 'none' })}.${part(payload)}.sig`;
}

const accessToken = () => jwt({ sub: '7', name: 'Asha', role: 'User', exp: Math.floor(Date.now() / 1000) + 3600 });
const tick = () => new Promise<void>((resolve) => setTimeout(resolve));

function setup() {
  localStorage.clear();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', children: [] }]),
      provideHttpClient(withInterceptors([errorInterceptor])),
      provideHttpClientTesting(),
    ],
  });
  const http = TestBed.inject(HttpTestingController);
  const fixture = TestBed.createComponent(SignInPage);
  fixture.detectChanges();
  return { http, fixture, el: fixture.nativeElement as HTMLElement };
}

const type = (input: HTMLInputElement, value: string) => {
  input.value = value;
  input.dispatchEvent(new Event('input'));
};

describe('looseEmail', () => {
  const check = (value: string) => looseEmail(new FormControl(value, { nonNullable: true }));

  it('accepts ordinary addresses and rejects obviously wrong ones', () => {
    expect(check('asha@example.com')).toBeNull();
    expect(check(' asha@example.com ')).toBeNull();
    expect(check('asha')).not.toBeNull();
    expect(check('@example.com')).not.toBeNull();
    expect(check('asha@')).not.toBeNull();
    expect(check('a b@example.com')).not.toBeNull();
    expect(check('a@@example.com')).not.toBeNull();
  });
});

describe('SignInPage', () => {
  it('does not call the API for an invalid email', () => {
    const { http, fixture, el } = setup();

    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    http.expectNone('/api/auth/otp/request');
    expect(el.textContent).toContain('Enter a valid email');
  });

  it('asks for the code after the email, then signs an existing user in', async () => {
    const { http, fixture, el } = setup();
    const auth = TestBed.inject(AuthService);

    type(el.querySelector<HTMLInputElement>('#email')!, ' Asha@Example.com ');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));

    const request = http.expectOne('/api/auth/otp/request');
    expect(request.request.body).toEqual({ email: 'Asha@Example.com' });
    request.flush({ expiresInSeconds: 300, resendAfterSeconds: 60 });
    fixture.detectChanges();

    expect(el.textContent).toContain('We sent a code');
    expect(el.textContent).toContain('asha@example.com');
    expect(el.textContent).toContain('Resend code in 60s');

    // The sixth digit submits by itself.
    type(el.querySelector<HTMLInputElement>('#code')!, '123456');
    const verify = http.expectOne('/api/auth/otp/verify');
    expect(verify.request.body).toEqual({ email: 'Asha@Example.com', code: '123456' });
    verify.flush({
      accessToken: accessToken(),
      expiresAt: '2026-11-05T00:00:00Z',
      user: { id: 7, name: 'Asha', email: 'asha@example.com', isOrganizer: false, isNewUser: false },
    });
    await tick();

    expect(auth.isSignedIn()).toBe(true);
    expect(auth.userId()).toBe(7);
  });

  it('asks a new user for their name without losing the code, then registers them', async () => {
    const { http, fixture, el } = setup();
    const auth = TestBed.inject(AuthService);

    type(el.querySelector<HTMLInputElement>('#email')!, 'new@example.com');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    http.expectOne('/api/auth/otp/request').flush({ expiresInSeconds: 300, resendAfterSeconds: 60 });
    fixture.detectChanges();

    type(el.querySelector<HTMLInputElement>('#code')!, '654321');
    http.expectOne('/api/auth/otp/verify').flush(
      { status: 400, title: 'Unable to sign in', detail: 'Tell us your name.', code: 'User.NameRequired' },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    expect(el.querySelector('#name')).not.toBeNull();
    expect(el.querySelector<HTMLInputElement>('#code')!.value).toBe('654321');
    expect(auth.isSignedIn()).toBe(false);

    type(el.querySelector<HTMLInputElement>('#name')!, '  Asha Rao ');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    const second = http.expectOne('/api/auth/otp/verify');
    expect(second.request.body).toEqual({ email: 'new@example.com', code: '654321', name: 'Asha Rao' });
    second.flush({
      accessToken: accessToken(),
      expiresAt: '2026-11-05T00:00:00Z',
      user: { id: 7, name: 'Asha Rao', email: 'new@example.com', isOrganizer: false, isNewUser: true },
    });
    await tick();

    expect(auth.isSignedIn()).toBe(true);
  });

  it('shows the API message for a wrong code and stays signed out', () => {
    const { http, fixture, el } = setup();

    type(el.querySelector<HTMLInputElement>('#email')!, 'asha@example.com');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    http.expectOne('/api/auth/otp/request').flush({ expiresInSeconds: 300, resendAfterSeconds: 60 });
    fixture.detectChanges();

    type(el.querySelector<HTMLInputElement>('#code')!, '000000');
    http.expectOne('/api/auth/otp/verify').flush(
      { status: 400, title: 'Unable to sign in', detail: 'The code is incorrect or has expired.', code: 'Otp.Invalid' },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('incorrect or has expired');
    expect(TestBed.inject(AuthService).isSignedIn()).toBe(false);
  });

  it('reports a rate limit from the request step', () => {
    const { http, fixture, el } = setup();

    type(el.querySelector<HTMLInputElement>('#email')!, 'asha@example.com');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    http.expectOne('/api/auth/otp/request').flush(
      { status: 429, title: 'Unable to send a code', detail: 'A code was sent a moment ago. Try again in 40 seconds.', code: 'Otp.TooManyRequests' },
      { status: 429, statusText: 'Too Many Requests' },
    );
    fixture.detectChanges();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Try again in 40 seconds');
    expect(el.querySelector('#code')).toBeNull();
  });
});
