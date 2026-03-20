import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class OrdenProduccionService {
  private apiUrl = 'https://frigometal-administracion.vercel.app/ordenes-produccion/'; 

  constructor(private http: HttpClient) { }

  getOrdenes(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  crearOrden(orden: any): Observable<any> {
    return this.http.post<any>(this.apiUrl, orden);
  }

  actualizarOrden(id: number, orden: any): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}${id}`, orden);
  }
}