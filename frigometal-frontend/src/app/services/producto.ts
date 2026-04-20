import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Producto {
  id_producto?: number; 
  nombre: string;
  tiempo_fabricacion_horas: number;
  es_estandar: boolean;
  parametro?: string;
}

@Injectable({ providedIn: 'root' })
export class ProductoService {
  private apiUrl = 'https://frigometal-administracion.vercel.app/productos/';

  constructor(private http: HttpClient) { }

  getProductos(): Observable<Producto[]> {
    return this.http.get<Producto[]>(this.apiUrl);
  }

  crearProducto(producto: Producto): Observable<Producto> {
    return this.http.post<Producto>(this.apiUrl, producto);
  }

  // 👇 NUEVA FUNCIÓN PARA ACTUALIZAR (CON PROTECCIÓN DE DOBLE BARRA) 👇
  actualizarProducto(id: number, producto: Partial<Producto>): Observable<Producto> {
    const urlFinal = this.apiUrl.endsWith('/') ? `${this.apiUrl}${id}` : `${this.apiUrl}/${id}`;
    return this.http.put<Producto>(urlFinal, producto);
  }

  importarCatalogoExcel(archivo: File): Observable<any> {
    const formData = new FormData();
    formData.append('file', archivo); 
    return this.http.post(`${this.apiUrl}importar-catalogo/`, formData);
  }
}