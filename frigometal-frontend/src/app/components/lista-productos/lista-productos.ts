import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatListModule } from '@angular/material/list'; // <-- NUEVO PARA LA LISTA DE RECETA
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';

import { Producto, ProductoService } from '../../services/producto'; // Revisa si es .service o no
import { Material, MaterialService } from '../../services/material';
import { RecetaDetalle, RecetaService } from '../../services/receta';

@Component({
  selector: 'app-lista-productos',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatTableModule, MatButtonModule, 
    MatIconModule, MatCardModule, MatFormFieldModule, 
    MatInputModule, MatSelectModule, MatListModule, MatSnackBarModule
  ],
  templateUrl: './lista-productos.html',
  styleUrls: ['./lista-productos.scss']
})
export class ListaProductos implements OnInit {
  dataSource = new MatTableDataSource<Producto>([]);
  // 👇 AGREGAMOS LA COLUMNA DE ACCIONES 👇
  columnasMostradas: string[] = ['id_producto', 'nombre', 'tiempo', 'es_estandar', 'acciones'];

  mostrarFormulario: boolean = false;
  guardando: boolean = false;

  modoEdicion: boolean = false;
  idProductoEditando: number | null = null;
  nuevoProducto: Producto = { nombre: '', tiempo_fabricacion_horas: 1, es_estandar: true };

  // === VARIABLES PARA LA RECETA ===
  productoSeleccionado: Producto | null = null;
  materialesBodega: Material[] = [];
  recetaActual: any[] = []; // Lo que ya tiene la receta
  
  // Lo que el usuario está agregando
  idMaterialSeleccionado: number | null = null;
  cantidadNecesaria: number = 1;

  constructor(
    private productoService: ProductoService,
    private materialService: MaterialService,
    private recetaService: RecetaService,
    private snackBar: MatSnackBar,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.cargarProductos();
    // Cargamos los materiales de la bodega una sola vez para el menú desplegable
    this.materialService.getMateriales().subscribe(datos => this.materialesBodega = datos);
  }

  cargarProductos(): void {
    this.productoService.getProductos().subscribe(datos => this.dataSource.data = datos);
  }

  toggleFormulario(): void { this.mostrarFormulario = !this.mostrarFormulario; }


  editarProducto(prod: Producto): void {
    this.modoEdicion = true;
    this.idProductoEditando = prod.id_producto!;
    this.mostrarFormulario = true;
    this.nuevoProducto = { ...prod }; // Copia los datos
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  guardarProducto(): void {
    if (!this.nuevoProducto.nombre || this.nuevoProducto.tiempo_fabricacion_horas <= 0) {
      this.snackBar.open('⚠️ Completa los datos correctamente', 'Cerrar', { duration: 3000 });
      return;
    }

    this.guardando = true;

    if (this.modoEdicion && this.idProductoEditando) {
      // 🟢 MODO ACTUALIZAR
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
      // 🔵 MODO CREAR
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
    // setTimeout evita el error NG0100 de Angular
    setTimeout(() => {
      this.mostrarFormulario = false;
      this.guardando = false;
      this.limpiarFormulario();
    }, 0);
  }

  limpiarFormulario(): void {
    this.modoEdicion = false;
    this.idProductoEditando = null;
    this.nuevoProducto = { nombre: '', tiempo_fabricacion_horas: 1, es_estandar: true };
  }

  // 👇 NUEVAS FUNCIONES PARA LA RECETA 👇

  abrirReceta(prod: Producto): void {
    this.productoSeleccionado = prod;
    this.cargarRecetaDelProducto();
    // Hacemos scroll hacia abajo para que el usuario vea el panel
    setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
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
        this.cargarRecetaDelProducto(); // Refrescamos la lista de la receta
        // Limpiamos los campos
        this.idMaterialSeleccionado = null;
        this.cantidadNecesaria = 1;
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

  // ==========================================
  // LÓGICA DE IMPORTACIÓN MASIVA (EXCEL)
  // ==========================================
  onArchivoSeleccionado(event: any): void {
    const archivo: File = event.target.files[0];
    
    if (archivo) {
      // Validación de seguridad para que solo suban Excels
      if (!archivo.name.endsWith('.xlsx') && !archivo.name.endsWith('.xls')) {
        this.snackBar.open('⚠️ Por favor, selecciona un archivo de Excel válido', 'Cerrar', { duration: 3000 });
        return;
      }

      this.snackBar.open('⏳ Subiendo catálogo y estructurando recetas...', '', { duration: 2000 });

      this.productoService.importarCatalogoExcel(archivo).subscribe({
        next: (respuesta) => {
          this.snackBar.open(`✅ ${respuesta.mensaje}`, 'Excelente', { duration: 5000 });
          
          // Si hubo filas con errores (ej. ID de material que no existe en el inventario)
          if (respuesta.errores && respuesta.errores.length > 0) {
            console.warn('Detalle de errores:', respuesta.errores);
            alert(`Se importó el catálogo, pero ignoramos algunas filas con errores:\n\n${respuesta.errores.join('\n')}`);
          }

          // 👇 Asegúrate de que esta función se llame igual que la tuya para recargar la tabla
          this.cargarProductos(); 
          event.target.value = ''; // Limpiamos el botón por si quieren subir otro Excel luego
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
}