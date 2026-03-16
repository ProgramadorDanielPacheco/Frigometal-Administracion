import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { Router } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private apiUrl = 'http://127.0.0.1:8000/login/';

  constructor(private http: HttpClient, private router: Router) { }

  cerrarSesion(): void {
    // 👇 Usamos la misma llave que en el login
    localStorage.removeItem('usuarioLogueado');
    this.router.navigate(['/login']);
  }

  estaAutenticado(): boolean {
    // 👇 Buscamos la llave correcta
    return !!localStorage.getItem('usuarioLogueado');
  }
  // 👇 NUEVA FUNCIÓN PARA EL LOGIN
  iniciarSesion(credenciales: any): Observable<any> {
    // Apuntamos a la nueva ruta /login/ que acabamos de crear en FastAPI
    return this.http.post('http://127.0.0.1:8000/login/', credenciales);
  }
}
