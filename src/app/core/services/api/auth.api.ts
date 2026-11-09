import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../config/api.config';
import { RequestOtpResult, VerifyOtpRequest, VerifyOtpResult } from '../../models/api.models';

/** Email sign-in. Registration and sign-in are one flow: request a code, then verify it. */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/auth`;

  /**
   * POST /api/auth/otp/request: emails a 6-digit code. The answer is the same whether or not the
   * email already has an account. Rate limited (`Otp.TooManyRequests`, 429).
   */
  requestOtp(email: string): Observable<RequestOtpResult> {
    return this.http.post<RequestOtpResult>(`${this.baseUrl}/otp/request`, { email });
  }

  /**
   * POST /api/auth/otp/verify: returns an access token. A new email must also send `name`;
   * without it the API answers `User.NameRequired` and the code stays valid.
   */
  verifyOtp(request: VerifyOtpRequest): Observable<VerifyOtpResult> {
    return this.http.post<VerifyOtpResult>(`${this.baseUrl}/otp/verify`, request);
  }
}
