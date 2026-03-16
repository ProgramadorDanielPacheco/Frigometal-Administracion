import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface OrdenTrabajo {
  id_orden_trabajo?: number;
  id_detalle_pedido: number;
  id_usuario: number;
  fecha_inicio: string;
  fecha_entrega_programada: string;
  estado?: string;
}

@Injectable({ providedIn: 'root' })
export class ProgramacionService {
  private apiUrl = 'https://frigometal-administracion.vercel.app/ordenes-trabajo/';
  constructor(private http: HttpClient) { }

  getOrdenes(): Observable<OrdenTrabajo[]> {
    return this.http.get<OrdenTrabajo[]>(this.apiUrl);
  }

  crearOrden(orden: OrdenTrabajo): Observable<any> {
    return this.http.post(this.apiUrl, orden);
  }

  actualizarEstadoOrden(id_orden: number, estado: string): Observable<any> {
    return this.http.patch(`http://127.0.0.1:8000/ordenes-trabajo/${id_orden}/estado`, { estado: estado });
  }
}
