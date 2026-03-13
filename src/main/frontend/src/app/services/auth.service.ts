import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, tap } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly TOKEN_KEY = 'cm_jwt';
  private readonly USERNAME_KEY = 'cm_user';
  private readonly ROLE_KEY = 'cm_role';
  private loggedIn$ = new BehaviorSubject<boolean>(this.hasToken());

  constructor(private http: HttpClient, private router: Router) {}

  login(username: string, password: string): Observable<{ token: string; username: string; role: string }> {
    return this.http.post<{ token: string; username: string; role: string }>('/api/auth/login', { username, password }).pipe(
      tap(res => {
        localStorage.setItem(this.TOKEN_KEY, res.token);
        localStorage.setItem(this.USERNAME_KEY, res.username);
        localStorage.setItem(this.ROLE_KEY, res.role ?? '');
        this.loggedIn$.next(true);
      })
    );
  }

  register(username: string, password: string): Observable<{ token: string; username: string; role: string }> {
    return this.http.post<{ token: string; username: string; role: string }>('/api/auth/register', { username, password }).pipe(
      tap(res => {
        localStorage.setItem(this.TOKEN_KEY, res.token);
        localStorage.setItem(this.USERNAME_KEY, res.username);
        localStorage.setItem(this.ROLE_KEY, res.role ?? '');
        this.loggedIn$.next(true);
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USERNAME_KEY);
    localStorage.removeItem(this.ROLE_KEY);
    this.loggedIn$.next(false);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getUsername(): string {
    return localStorage.getItem(this.USERNAME_KEY) ?? '';
  }

  getRole(): string {
    return localStorage.getItem(this.ROLE_KEY) ?? '';
  }

  isAdmin(): boolean {
    return this.getRole() === 'ROLE_ADMIN';
  }

  isLoggedIn(): Observable<boolean> {
    return this.loggedIn$.asObservable();
  }

  isAuthenticated(): boolean {
    return this.hasToken();
  }

  private hasToken(): boolean {
    return !!localStorage.getItem(this.TOKEN_KEY);
  }
}
