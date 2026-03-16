import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Proveedor {
  id_proveedor?: number;
  nombre: string;
}

export interface PrecioProveedor {
  id_material: number;
  id_proveedor: number;
  precio_unitario: number;
  descuento_porcentaje: number;
}

@Injectable({ providedIn: 'root' })
export class ProveedorService {
  private apiUrl = 'http://127.0.0.1:8000';

  constructor(private http: HttpClient) { }

  getProveedores(): Observable<Proveedor[]> {
    return this.http.get<Proveedor[]>(`${this.apiUrl}/proveedores/`);
  }

  crearProveedor(proveedor: Proveedor): Observable<Proveedor> {
    return this.http.post<Proveedor>(`${this.apiUrl}/proveedores/`, proveedor);
  }

  // 👇 Para alimentar las compras inteligentes
  asignarPrecio(precio: PrecioProveedor): Observable<any> {
    return this.http.post(`${this.apiUrl}/precios-proveedor/`, precio);
  }

  importarProveedoresExcel(archivo: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', archivo); 
    
    // 👇 Cambiamos 'importar/' por 'importar-catalogo/'
    return this.http.post(`${this.apiUrl}importar-catalogo/`, formData);
  }
}