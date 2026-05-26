import { Component, OnInit, ChangeDetectorRef, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardActions, MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatListModule } from '@angular/material/list'; 
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';

import { Producto, ProductoService } from '../../services/producto'; 
import { Material, MaterialService } from '../../services/material';
import { RecetaDetalle, RecetaService } from '../../services/receta';
import { ReportesService } from '../../services/reportes';
import { MatMenuModule } from '@angular/material/menu';
import { OrdenProduccionService } from '../../services/orden-produccion';
import { MatSort, MatSortModule } from '@angular/material/sort';

@Component({
  selector: 'app-lista-productos',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatButtonModule, 
    MatIconModule, MatCardModule, MatFormFieldModule, 
    MatInputModule, MatSelectModule, MatListModule, MatSnackBarModule, MatMenuModule, MatSortModule
  ],
  templateUrl: './lista-productos.html',
  styleUrls: ['./lista-productos.scss']
})
export class ListaProductos implements OnInit, AfterViewInit {
  dataSource = new MatTableDataSource<Producto>([]);
  columnasMostradas: string[] = ['id_producto', 'nombre', 'parametro', 'tiempo', 'es_estandar', 'acciones'];

  @ViewChild(MatSort) sort!: MatSort;
  textoBusqueda: string = '';

  mostrarFormulario: boolean = false;
  guardando: boolean = false;

  modoEdicion: boolean = false;
  idProductoEditando: number | null = null;
  nuevoProducto: Producto = { nombre: '', tiempo_fabricacion_horas: 1, es_estandar: true, parametro: '' };

  // === VARIABLES PARA LA RECETA ===
  productoSeleccionado: Producto | null = null;
  materialesBodega: Material[] = [];
  recetaActual: any[] = []; 

  get recetaOrdenada(): any[] {
    return [...this.recetaActual].sort((a, b) => {
      const nombreA = this.obtenerNombreMaterial(a.id_material).toLowerCase();
      const nombreB = this.obtenerNombreMaterial(b.id_material).toLowerCase();
      return nombreA.localeCompare(nombreB);
    });
  }
  
  idMaterialSeleccionado: number | null = null;
  cantidadNecesaria: number = 1;

  filtroMateriales: string = '';

  idEditandoReceta: number | null = null;
  cantidadEditada: number = 0;
  ultimaOPDetectada: number = 1;

  constructor(
    private productoService: ProductoService,
    private materialService: MaterialService,
    private reportesService: ReportesService,
    private recetaService: RecetaService,
    private snackBar: MatSnackBar,
    private ordenService: OrdenProduccionService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarProductos();
    this.materialService.getMateriales().subscribe(datos => this.materialesBodega = datos);
    this.cargarMaterialesBodega();
    this.ordenService.getOrdenes().subscribe(ordenes => {
      let maxOP = 0;
      ordenes.forEach((orden: any) => {
        if (orden.equipos) {
          orden.equipos.forEach((equipo: any) => {
            const op = Number(equipo.orden_produccion) || 0;
            if (op > maxOP) maxOP = op;
          });
        }
      });
      this.ultimaOPDetectada = maxOP > 0 ? maxOP : 1;
    });
  }

  ngAfterViewInit() {
    this.dataSource.sort = this.sort;
  }

  aplicarFiltroTexto(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.textoBusqueda = filterValue;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  cargarProductos(): void {
    this.productoService.getProductos().subscribe(datos => this.dataSource.data = datos);
  }

  toggleFormulario(): void { this.mostrarFormulario = !this.mostrarFormulario; }

  cargarMaterialesBodega(): void {
    this.materialService.getMateriales().subscribe({
      next: (datos) => {
        this.materialesBodega = datos;
      },
      error: (err) => console.error('Error al cargar materiales', err)
    });
  }

  editarProducto(prod: Producto): void {
    this.modoEdicion = true;
    this.idProductoEditando = prod.id_producto!;
    this.mostrarFormulario = true;
    this.nuevoProducto = { ...prod }; 
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  guardarProducto(): void {
    if (!this.nuevoProducto.nombre || this.nuevoProducto.tiempo_fabricacion_horas <= 0) {
      this.snackBar.open('⚠️ Completa los datos correctamente', 'Cerrar', { duration: 3000 });
      return;
    }

    this.guardando = true;

    if (this.modoEdicion && this.idProductoEditando) {
      this.productoService.actualizarProducto(this.idProductoEditando, this.nuevoProducto).subscribe({
        next: () => {
          this.snackBar.open('✅ Producto actualizado', 'Excelente', { duration: 3000 });
          this.finalizarGuardado();
        },
        error: () => {
          this.guardando = false;
          this.snackBar.open('❌ Error al actualizar', 'Cerrar', { duration: 3000 });
        }
      });
    } else {
      this.productoService.crearProducto(this.nuevoProducto).subscribe({
        next: () => {
          this.snackBar.open('✅ Producto registrado', 'Excelente', { duration: 3000 });
          this.finalizarGuardado();
        },
        error: () => {
          this.guardando = false;
          this.snackBar.open('❌ Error al guardar', 'Cerrar', { duration: 3000 });
        }
      });
    }
  }

  finalizarGuardado(): void {
    this.cargarProductos();
    setTimeout(() => {
      this.mostrarFormulario = false;
      this.guardando = false;
      this.limpiarFormulario();
    }, 0);
  }

  get materialesFiltrados(): Material[] {
  if (!this.filtroMateriales) {
    return this.materialesBodega;
  }
  return this.materialesBodega.filter(mat => 
    mat.nombre.toLowerCase().includes(this.filtroMateriales.toLowerCase())
  );
}

  limpiarFormulario(): void {
    this.modoEdicion = false;
    this.idProductoEditando = null;
    this.nuevoProducto = { nombre: '', tiempo_fabricacion_horas: 1, es_estandar: true, parametro: '' };
  }

  // 👇 FUNCIÓN CORREGIDA PARA HACER SCROLL INSTANTÁNEO 👇
  abrirReceta(prod: Producto): void {
    this.productoSeleccionado = prod;
    this.cargarMaterialesBodega(); 
    this.cargarRecetaDelProducto();
    
    // Obligamos a Angular a dibujar el HTML inmediatamente
    this.cdr.detectChanges(); 
    
    // Ahora que el HTML existe, bajamos directo a ese ID
    setTimeout(() => {
      const panelReceta = document.getElementById('panel-receta-tecnica');
      if (panelReceta) {
        panelReceta.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50); 
  }

  cerrarReceta(): void {
    this.productoSeleccionado = null;
    this.recetaActual = [];
  }

  cargarRecetaDelProducto(): void {
    if (this.productoSeleccionado?.id_producto) {
      this.recetaService.getReceta(this.productoSeleccionado.id_producto).subscribe({
        next: (datos) =>{ this.recetaActual = datos
          this.cdr.detectChanges();
        },
        error: (err) => {console.error('Error al cargar receta', err)}
      });
    }
  }

  agregarIngrediente(): void {
    if (!this.productoSeleccionado?.id_producto || !this.idMaterialSeleccionado || this.cantidadNecesaria <= 0) {
      this.snackBar.open('⚠️ Selecciona un material y cantidad', 'Cerrar', { duration: 3000 });
      return;
    }

    const detalle: RecetaDetalle = {
      id_producto: this.productoSeleccionado.id_producto,
      id_material: this.idMaterialSeleccionado,
      cantidad_necesaria: this.cantidadNecesaria
    };

    this.recetaService.agregarMaterial(detalle).subscribe({
      next: () => {
        this.snackBar.open('✅ Material agregado a la receta', 'OK', { duration: 3000 });
        this.cargarRecetaDelProducto(); 
        this.idMaterialSeleccionado = null;
        this.cantidadNecesaria = 1;
        this.filtroMateriales = '';
      },
      error: (err) => this.snackBar.open('❌ Error al agregar', 'Cerrar', { duration: 3000 })
    });
  }

  eliminarIngrediente(idEstructura: number): void {
    this.recetaService.eliminarMaterial(idEstructura).subscribe({
      next: () => {
        this.snackBar.open('🗑️ Material retirado', 'OK', { duration: 3000 });
        this.cargarRecetaDelProducto();
      }
    });
  }

  obtenerNombreMaterial(idMaterial: number): string {
    const material = this.materialesBodega.find(m => m.id_material === idMaterial);
    return material ? material.nombre : `Material Desconocido (#${idMaterial})`;
  }

  obtenerUnidadMedida(idMaterial: number): string {
  const material = this.materialesBodega.find(m => m.id_material === idMaterial);
  return material ? material.unidad_medida : '';
}

obtenerPrecioMaterial(idMaterial: number): number {
  const material = this.materialesBodega.find(m => m.id_material === idMaterial);
  return material ? Number(material.precio_unitario) : 0;
}

calcularSubtotal(item: any): number {
  const precio = this.obtenerPrecioMaterial(item.id_material);
  const cantidad = item.cantidad_necesaria || item.cantidad_requerida || 0;
  return precio * cantidad;
}

calcularCostoTotalReceta(): number {
  return this.recetaActual.reduce((total, item) => total + this.calcularSubtotal(item), 0);
}

  onArchivoSeleccionado(event: any): void {
    const archivo: File = event.target.files[0];
    
    if (archivo) {
      if (!archivo.name.endsWith('.xlsx') && !archivo.name.endsWith('.xls')) {
        this.snackBar.open('⚠️ Por favor, selecciona un archivo de Excel válido', 'Cerrar', { duration: 3000 });
        return;
      }

      this.snackBar.open('⏳ Subiendo catálogo y estructurando recetas...', '', { duration: 2000 });

      this.productoService.importarCatalogoExcel(archivo).subscribe({
        next: (respuesta) => {
          this.snackBar.open(`✅ ${respuesta.mensaje}`, 'Excelente', { duration: 5000 });
          
          if (respuesta.errores && respuesta.errores.length > 0) {
            console.warn('Detalle de errores:', respuesta.errores);
            alert(`Se importó el catálogo, pero ignoramos algunas filas con errores:\n\n${respuesta.errores.join('\n')}`);
          }

          this.cargarProductos(); 
          event.target.value = ''; 
        },
        error: (err) => {
          console.error(err);
          const mensaje = err.error?.detail || 'Error al procesar el archivo Excel';
          this.snackBar.open(`❌ ${mensaje}`, 'Cerrar', { duration: 4000 });
          event.target.value = ''; 
        }
      });
    }
  }

  generarReporte(formato: 'excel' | 'pdf'): void {
    const productos = this.dataSource.data;
    
    if (productos.length === 0) {
      this.snackBar.open('⚠️ No hay productos para exportar', 'Cerrar', { duration: 3000 });
      return;
    }

    this.snackBar.open('⏳ Recopilando recetas y calculando costos...', '', { duration: 2500 });

    const peticionesRecetas = productos.map(prod => 
      this.recetaService.getReceta(prod.id_producto!).pipe(
        catchError(() => of([])) 
      )
    );

    forkJoin(peticionesRecetas).subscribe({
      next: (todasLasRecetas) => {
        
        const datosLimpios = productos.map((prod, index) => {
          const recetaDelProducto = todasLasRecetas[index];
          
          let recetaTexto = 'Sin materiales';
          let costoTotal = 0;

          if (recetaDelProducto && recetaDelProducto.length > 0) {
            
            const detallesMapeados = recetaDelProducto.map((r: any) => {
              
              const materialBD = this.materialesBodega.find(m => m.id_material === r.id_material);
              
              const nombreMat = materialBD ? materialBD.nombre : 'Material Desconocido';
              const precioMat = materialBD ? Number(materialBD.precio_unitario || 0) : 0;
              
              const cantidadMat = Number(r.cantidad_requerida || r.cantidad_necesaria || 0);

              costoTotal += (cantidadMat * precioMat);

              return `${nombreMat} (${cantidadMat})`;
            });

            recetaTexto = detallesMapeados.join(' | ');
          }

          return {
            'ID': prod.id_producto,
            'Nombre del Producto': prod.nombre,
            'Tiempo (Horas)': prod.tiempo_fabricacion_horas,
            'Tipo': prod.es_estandar ? 'Estándar' : 'A Medida',
            'Receta (Materiales)': recetaTexto,
            'Costo Total ($)': costoTotal.toFixed(2)
          };
        });

        if (formato === 'excel') {
          this.reportesService.exportarExcel(datosLimpios, 'Catalogo_Frigometal');
        } else {
          const columnas = ['ID', 'Nombre del Producto', 'Tiempo (Horas)', 'Tipo', 'Receta (Materiales)', 'Costo Total ($)'];
          this.reportesService.exportarPDF(datosLimpios, columnas, 'Catálogo de Productos y Costos', 'Catalogo_Frigometal');
        }
      },
      error: (err) => {
        console.error('Error al compilar reporte', err);
        this.snackBar.open('❌ Hubo un error al generar el reporte', 'Cerrar', { duration: 3000 });
      }
    });
  }

  iniciarEdicionMaterial(item: any): void {
    this.idEditandoReceta = item.id_estructura; 
    this.cantidadEditada = item.cantidad_necesaria || item.cantidad_requerida || 0;
  }

  cancelarEdicionMaterial(): void {
    this.idEditandoReceta = null;
    this.cantidadEditada = 0;
  }

  guardarEdicionMaterial(item: any): void {
    if (this.cantidadEditada <= 0) {
      this.snackBar.open('⚠️ La cantidad debe ser mayor a 0', 'Cerrar', { duration: 3000 });
      return;
    }

    const payload = { cantidad_necesaria: this.cantidadEditada };

    this.recetaService.actualizarMaterial(item.id_estructura, payload).subscribe({
      next: () => {
        this.snackBar.open('✅ Cantidad actualizada', 'OK', { duration: 3000 });
        this.idEditandoReceta = null;
        this.cargarRecetaDelProducto(); 
      },
      error: (err) => this.snackBar.open('❌ Error al actualizar', 'Cerrar', { duration: 3000 })
    });
  }

  imprimirReceta(): void {
    if (!this.productoSeleccionado || this.recetaActual.length === 0) {
      this.snackBar.open('⚠️ No hay materiales en la receta para imprimir', 'Cerrar', { duration: 3000 });
      return;
    }

    const opSeleccionada = window.prompt(
      '🖨️ Ingrese el Número de OP (Máquina) para imprimir en esta receta:', 
      this.ultimaOPDetectada.toString()
    );

    if (opSeleccionada === null) return; 

    const numeroOP = opSeleccionada.trim() || 'S/N';

    const recetaOrdenada = [...this.recetaActual].sort((a, b) => {
      const nombreA = this.obtenerNombreMaterial(a.id_material).toLowerCase();
      const nombreB = this.obtenerNombreMaterial(b.id_material).toLowerCase();
      return nombreA.localeCompare(nombreB);
    });

    let filasMateriales = '';
    recetaOrdenada.forEach(item => {
      const nombreMat = this.obtenerNombreMaterial(item.id_material);
      const unidad = this.obtenerUnidadMedida(item.id_material);
      const cantidad = item.cantidad_necesaria || item.cantidad_requerida || 0;

      filasMateriales += `
        <tr>
          <td style="text-align: left; padding: 10px; border: 1px solid #ccc;">${nombreMat}</td>
          <td style="text-align: center; padding: 10px; border: 1px solid #ccc; font-weight: bold; font-size: 1.1em;">${cantidad} ${unidad}</td>
        </tr>
      `;
    });

    const nombreProducto = this.productoSeleccionado.nombre;
    const tiempoFab = this.productoSeleccionado.tiempo_fabricacion_horas;
    const tipoProd = this.productoSeleccionado.es_estandar ? 'Estándar (En Serie)' : 'A Medida (Especial)';
    
    const parametrosProd = this.productoSeleccionado.parametro || 'No se registraron especificaciones adicionales para este equipo.';

    const ventanaImpresion = window.open('', '_blank', 'width=900,height=700');
    if (ventanaImpresion) {
      ventanaImpresion.document.write(`
        <html>
          <head>
            <title>Receta Taller OP-${numeroOP} - ${nombreProducto}</title>
            <style>
              body { font-family: 'Arial', sans-serif; padding: 20px; color: #333; margin: 0; }
              .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #1976d2; padding-bottom: 15px; margin-bottom: 20px; }
              .header img { height: 60px; }
              .header-text { text-align: right; }
              .header-text h1 { margin: 0; color: #1976d2; font-size: 22px; font-weight: bold; font-style: italic; }
              .header-text p { margin: 5px 0 0 0; font-size: 13px; color: #666; }
              
              .numero-op { color: #d32f2f; font-size: 24px; font-weight: 900; margin: 5px 0; display: block; }
              
              .product-info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; border-left: 6px solid #2e7d32; border-top: 1px solid #eee; border-right: 1px solid #eee; border-bottom: 1px solid #eee; }
              .product-info h2 { margin: 0 0 10px 0; color: #2e7d32; font-size: 18px; text-transform: uppercase; }
              .product-info p { margin: 3px 0; font-size: 14px; }
              
              table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; }
              th { background-color: #1976d2; color: white; padding: 12px; text-align: center; border: 1px solid #0d47a1; font-size: 15px; }
              tr:nth-child(even) { background-color: #f2f2f2; }
              
              .parametros-box { margin-top: 20px; padding: 15px; border: 2px dashed #1976d2; background-color: #e3f2fd; border-radius: 8px; }
              .parametros-box h3 { margin: 0 0 8px 0; color: #1565c0; font-size: 16px; text-transform: uppercase; }
              .parametros-box p { margin: 0; font-size: 14px; line-height: 1.5; white-space: pre-wrap; font-weight: 500; }

              @media print {
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <img src="/logo.png" alt="Frigo Metal" onerror="this.style.display='none'">
              <div class="header-text">
                <h1>FRIGO METAL</h1>
                <span class="numero-op">OP N° ${numeroOP}</span>
                <p>Hoja de Despacho Bodega y Taller</p>
                <p><b>Fecha:</b> ${new Date().toLocaleDateString('es-ES')}</p>
              </div>
            </div>

            <div class="product-info">
              <h2>${nombreProducto}</h2>
              <p><b>Tiempo de Fabricación Estimado:</b> ${tiempoFab} horas</p>
              <p><b>Clasificación:</b> ${tipoProd}</p>
            </div>

            <table>
              <thead>
                <tr>
                  <th style="width: 75%; text-align: left; padding-left: 15px;">MATERIAL REQUERIDO</th>
                  <th style="width: 25%;">CANTIDAD</th>
                </tr>
              </thead>
              <tbody>
                ${filasMateriales}
              </tbody>
            </table>

            <div class="parametros-box">
              <h3>Especificaciones Técnicas / Parámetros:</h3>
              <p>${parametrosProd}</p>
            </div>

            <div style="clear: both; margin-top: 50px; font-size: 11px; color: gray; text-align: center; border-top: 1px dashed #ccc; padding-top: 10px;">
              Documento interno de uso exclusivo para el área de producción y bodega. (Versión sin información financiera)
            </div>

            <script>
              window.onload = function() {
                setTimeout(function() { window.print(); window.close(); }, 500);
              };
            </script>
          </body>
        </html>
      `);
      ventanaImpresion.document.close();
    }
  }
}