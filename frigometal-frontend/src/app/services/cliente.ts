import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

// 👇 Ajustado exactamente a tu modelo de Python 👇
export interface Cliente {
  id_cliente: string;
  nombre: string;
  telefono?: string;
  correo?: string;
  direccion?: string; 
}

@Injectable({ providedIn: 'root' })
export class ClienteService {
  private apiUrl = 'http://127.0.0.1:8000/clientes/';

  constructor(private http: HttpClient) { }

  getClientes(): Observable<Cliente[]> {
    return this.http.get<Cliente[]>(this.apiUrl);
  }

  crearCliente(cliente: Cliente): Observable<Cliente> {
    return this.http.post<Cliente>(this.apiUrl, cliente);
  }

  // 👇 NUEVA FUNCIÓN PARA ENVIAR EL EXCEL
  importarClientesExcel(archivo: File): Observable<any> {
    const formData = new FormData();
    // 'file' debe llamarse exactamente igual que el parámetro en tu función de Python
    formData.append('file', archivo); 
    
    return this.http.post(`${this.apiUrl}importar/`, formData);
  }
}