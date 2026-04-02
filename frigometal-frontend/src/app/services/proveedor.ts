import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface PrecioProveedor {
  id_precio?: number; // Asegúrate de tener el ID para poder editar después
  id_material: number;
  id_proveedor: number;
  precio_unitario: number;
  descuento_porcentaje: number;
}

export interface Proveedor {
  id_proveedor?: number;
  nombre: string;
  precios?: PrecioProveedor[]; // 👈 Añadimos el arreglo opcional
}

@Injectable({ providedIn: 'root' })
export class ProveedorService {
  private apiUrl = 'http://127.0.0.1:8000/';

  constructor(private http: HttpClient) { }

  getProveedores(): Observable<Proveedor[]> {
    return this.http.get<Proveedor[]>(`${this.apiUrl}proveedores/`);
  }

  crearProveedor(proveedor: Proveedor): Observable<Proveedor> {
    return this.http.post<Proveedor>(`${this.apiUrl}proveedores/`, proveedor);
  }

  // 👇 Para alimentar las compras inteligentes
  asignarPrecio(precio: PrecioProveedor): Observable<any> {
    return this.http.post(`${this.apiUrl}precios-proveedor/`, precio);
  }

  // 👇 NUEVAS FUNCIONES PARA EDICIÓN 👇
  actualizarProveedor(id: number, datos: any): Observable<any> {
    return this.http.put(`${this.apiUrl}proveedores/${id}`, datos);
  }

  getPreciosProveedor(id: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}proveedores/${id}/precios`);
  }

  actualizarPrecio(id: number, datos: any): Observable<any> {
    return this.http.put(`${this.apiUrl}precios-proveedor/${id}`, datos);
  }

  importarProveedoresExcel(archivo: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', archivo); 
    
    // 👇 Cambiamos 'importar/' por 'importar-catalogo/'
    return this.http.post(`${this.apiUrl}importar-catalogo/`, formData);
  }
}