import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// La estructura de la Orden de Compra que nos envía FastAPI
export interface OrdenCompra {
  id_orden_compra: number;
  id_proveedor: number;
  estado: string;
}

@Injectable({
  providedIn: 'root'
})
export class CompraService {
  private apiUrl = 'https://frigometal-administracion.vercel.app/ordenes-compra/';

  constructor(private http: HttpClient) { }

  getOrdenes(): Observable<OrdenCompra[]> {
    return this.http.get<OrdenCompra[]>(this.apiUrl);
  }

  getDetallesOrden(id_orden: number): Observable<any[]> {
    const urlFinal = this.apiUrl.endsWith('/') ? `${this.apiUrl}${id_orden}/detalles` : `${this.apiUrl}/${id_orden}/detalles`;
    return this.http.get<any[]>(urlFinal);
  }

  // 👇 NUEVA FUNCIÓN: Actualizar el estado (Borrador -> Enviado)
  actualizarEstadoOrden(id_orden: number, estado: string): Observable<any> {
    const urlFinal = this.apiUrl.endsWith('/') ? `${this.apiUrl}${id_orden}/estado` : `${this.apiUrl}/${id_orden}/estado`;
    return this.http.patch(urlFinal, { estado: estado });
  }

  // Para llenar el selector de proveedores
  getProveedores(): Observable<any[]> {
    return this.http.get<any[]>('hhttps://frigometal-administracion.vercel.app/proveedores/');
  }

  // Para guardar los cambios del borrador
  editarOrdenCompra(id_orden: number, datos: any): Observable<any> {
    const urlFinal = this.apiUrl.endsWith('/') ? `${this.apiUrl}${id_orden}` : `${this.apiUrl}/${id_orden}`;
    return this.http.put(urlFinal, datos);
  }
}