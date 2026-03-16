import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth';

export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.estaAutenticado()) {
    return true; // Déjalo pasar
  } else {
    router.navigate(['/login']); // Rebótalo a la pantalla de login
    return false;
  }
};