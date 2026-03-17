import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Mantenimiento {
  id_mantenimiento?: number;
  id_cliente: string;
  id_producto: number;
  fecha_mantenimiento: string;
  descripcion: string;
  estado: string;
}

@Injectable({ providedIn: 'root' })
export class MantenimientoService {
  private apiUrl = 'https://frigometal-administracion.vercel.app/mantenimientos';

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