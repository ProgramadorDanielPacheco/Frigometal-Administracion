import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Usuario {
  id_usuario: string; // Opcional porque al crear uno nuevo aún no tiene ID
  nombre: string;
  correo: string;      // 👈 NUEVO: Requerido
  password?: string;   // 👈 NUEVO: Opcional (?) porque lo envías al crear, pero Python no te lo devuelve al leer por seguridad
  rol: string;
  horas_maximas_semanales: number;
  activo?: boolean;    // 👈 NUEVO: Opcional, por si quieres desactivar a un extrabajador en el futuro
}

@Injectable({ providedIn: 'root' })
export class UsuarioService {
  private apiUrl = 'http://127.0.0.1:8000/usuarios/';
  constructor(private http: HttpClient) { }

  getUsuarios(): Observable<Usuario[]> {
    return this.http.get<Usuario[]>(this.apiUrl);
  }

  crearUsuario(usuario: Usuario): Observable<Usuario> {
    return this.http.post<Usuario>(this.apiUrl, usuario);
  }

  // En tu UsuarioService
  actualizarUsuario(id_usuario: string, datosUsuario: any): Observable<any> {
    const urlFinal = this.apiUrl.endsWith('/') ? `${this.apiUrl}${id_usuario}` : `${this.apiUrl}/${id_usuario}`;
    return this.http.put(urlFinal, datosUsuario);
  }

  importarUsuariosExcel(archivo: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', archivo); 
    return this.http.post(`${this.apiUrl}importar/`, formData);
  }
}