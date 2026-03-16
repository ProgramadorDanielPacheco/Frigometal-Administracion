import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RecetaDetalle {
  id_estructura?: number;
  id_producto: number;
  id_material: number;
  cantidad_necesaria: number;
}

@Injectable({ providedIn: 'root' })
export class RecetaService {
  // 👇 Revisa en tu Swagger de Python si la ruta es /estructuras/ o /recetas/ 👇
  private apiUrl = 'http://127.0.0.1:8000/estructura-producto/'; 

  constructor(private http: HttpClient) { }

  // Obtener los materiales de un producto específico
  getReceta(idProducto: number): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}${idProducto}`);
  }

  // Agregar un material a la receta
  agregarMaterial(detalle: RecetaDetalle): Observable<any> {
    return this.http.post(this.apiUrl, detalle);
  }

  // Eliminar un material de la receta
  eliminarMaterial(idEstructura: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}${idEstructura}`);
  }
}
