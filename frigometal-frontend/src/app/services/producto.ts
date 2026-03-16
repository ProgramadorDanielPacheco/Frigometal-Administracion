import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Producto {
  id_producto?: number; // Opcional al crear
  nombre: string;
  tiempo_fabricacion_horas: number;
  es_estandar: boolean;
}

@Injectable({ providedIn: 'root' })
export class ProductoService {
  private apiUrl = 'http://127.0.0.1:8000/productos/';

  constructor(private http: HttpClient) { }

  getProductos(): Observable<Producto[]> {
    return this.http.get<Producto[]>(this.apiUrl);
  }

  // 👇 NUEVA FUNCIÓN PARA CREAR EL PRODUCTO 👇
  crearProducto(producto: Producto): Observable<Producto> {
    return this.http.post<Producto>(this.apiUrl, producto);
  }

  // 👇 NUEVA FUNCIÓN PARA IMPORTAR PRODUCTOS Y SU ESTRUCTURA (BOM)
  importarCatalogoExcel(archivo: File): Observable<any> {
    const formData = new FormData();
    // 'file' debe coincidir con el nombre del parámetro en FastAPI
    formData.append('file', archivo); 
    
    // Asegúrate de que this.apiUrl apunte a tu endpoint base de productos
    return this.http.post(`${this.apiUrl}importar-catalogo/`, formData);
  }
}