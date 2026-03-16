import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface DetallePedido {
  id_producto: number;
  cantidad: number;
}

export interface Pedido {
  id_cliente: number;
  detalles: DetallePedido[];
}

@Injectable({ providedIn: 'root' })
export class PedidoService {
  private apiUrl = 'https://frigometal-administracion.vercel.app/pedidos/';

  constructor(private http: HttpClient) { }

  // 👇 Esta es la que agregamos para que la tabla pueda mostrar el historial
  getPedidos(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl);
  }

  crearPedido(pedido: Pedido): Observable<any> {
    return this.http.post(this.apiUrl, pedido);
  }

  // 👇 NUEVA FUNCIÓN PARA ACTUALIZAR EL ESTADO
  actualizarEstado(id_pedido: number, estado: string): Observable<any> {
    // Usamos PATCH porque solo vamos a modificar una columna de la tabla
    return this.http.patch(`${this.apiUrl}${id_pedido}/estado`, { estado: estado });
  }

  importarPedidosExcel(archivo: File): Observable<any> {
    const formData = new FormData();
    // 'file' debe llamarse exactamente igual que el parámetro en tu función de Python
    formData.append('file', archivo); 
    
    return this.http.post(`${this.apiUrl}importar/`, formData);
  }

  
}
