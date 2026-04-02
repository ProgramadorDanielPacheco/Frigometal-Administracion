import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Mantenimiento {
  id_mantenimiento?: number;
  id_cliente: string;
  nombre_producto: string; // 👈 CAMBIADO
  fecha_mantenimiento: string;
  descripcion: string;
  estado: string;
}

@Injectable({ providedIn: 'root' })
export class MantenimientoService {
  private apiUrl = 'http://127.0.0.1:8000/mantenimientos';

  constructor(private http: HttpClient) { }

  getMantenimientos(): Observable<Mantenimiento[]> {
    return this.http.get<Mantenimiento[]>(this.apiUrl);
  }

  crear(mante: Mantenimiento): Observable<Mantenimiento> {
    return this.http.post<Mantenimiento>(this.apiUrl, mante);
  }

  actualizar(id: number, mante: Partial<Mantenimiento>): Observable<Mantenimiento> {
    return this.http.put<Mantenimiento>(`${this.apiUrl}/${id}`, mante);
  }
}