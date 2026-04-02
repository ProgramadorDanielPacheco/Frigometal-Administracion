import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// 👇 Ajustado exactamente a tu modelo de Python 👇
export interface Cliente {
  id_cliente: string;
  nombre: string;
  nombre_comercial?: string;
  telefono?: string;
  correo?: string;
  direccion?: string; 
  ciudad?: string;
}

@Injectable({ providedIn: 'root' })
export class ClienteService {
  private apiUrl = 'https://frigometal-administracion.vercel.app/clientes/';

  constructor(private http: HttpClient) { }

  getClientes(): Observable<Cliente[]> {
    return this.http.get<Cliente[]>(this.apiUrl);
  }

  crearCliente(cliente: Cliente): Observable<Cliente> {
    return this.http.post<Cliente>(this.apiUrl, cliente);
  }

  // 👇 NUEVA FUNCIÓN PARA ACTUALIZAR CLIENTE
  actualizarCliente(id_cliente: string, cliente: any): Observable<Cliente> {
    const urlFinal = this.apiUrl.endsWith('/') ? `${this.apiUrl}${id_cliente}` : `${this.apiUrl}/${id_cliente}`;
    return this.http.put<Cliente>(urlFinal, cliente);
  }

  // 👇 NUEVA FUNCIÓN PARA ELIMINAR CLIENTE 👇
  eliminarCliente(id_cliente: string): Observable<any> {
    const urlFinal = this.apiUrl.endsWith('/') ? `${this.apiUrl}${id_cliente}` : `${this.apiUrl}/${id_cliente}`;
    return this.http.delete(urlFinal);
  }

  // 👇 NUEVA FUNCIÓN PARA ENVIAR EL EXCEL
  importarClientesExcel(archivo: File): Observable<any> {
    const formData = new FormData();
    // 'file' debe llamarse exactamente igual que el parámetro en tu función de Python
    formData.append('file', archivo); 
    
    return this.http.post(`${this.apiUrl}importar/`, formData);
  }
}