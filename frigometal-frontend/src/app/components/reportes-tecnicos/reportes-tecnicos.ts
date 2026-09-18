import { Component, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, MAT_DATE_LOCALE } from '@angular/material/core';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSort, MatSortModule } from '@angular/material/sort';

import { ReporteTecnico,RepuestoAsignado, ReporteTecnicoService } from '../../services/reporte-tecnico';
import { Material, MaterialService } from '../../services/material';
import { ClienteService } from '../../services/cliente';

@Component({
  selector: 'app-reportes-tecnicos',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatFormFieldModule, 
    MatInputModule, MatButtonModule, MatIconModule, MatDatepickerModule, 
    MatNativeDateModule, MatSnackBarModule, MatTableModule, MatSelectModule,
    MatCheckboxModule, MatSortModule
  ],
  templateUrl: './reportes-tecnicos.html',
  providers: [{ provide: MAT_DATE_LOCALE, useValue: 'es-ES' }]
})
export class ReportesTecnicos implements OnInit, AfterViewInit {

  dataSource = new MatTableDataSource<ReporteTecnico>([]);
  columnasMostradas: string[] = ['id_reporte', 'fecha', 'cliente_nombre', 'equipo', 'estado_actual', 'presupuesto_total', 'acciones'];
  @ViewChild(MatSort) sort!: MatSort;

  mostrarFormulario: boolean = false;
  modoEdicion: boolean = false;
  guardando: boolean = false;
  textoBusqueda: string = '';

  materialesBodega: Material[] = [];
  filtroMateriales: string = '';
  clientesDirectorio: any[] = [];
  filtroClientes: string = '';

  nuevoReporte: ReporteTecnico = this.obtenerModeloVacio();

  // 👇 LISTAS DE CHECKS BASADAS EN TU FORMATO FÍSICO 👇
  listaFallas = [
    'No enciende', 'Cable/conector', 'Fusible', 'Tarjeta', 'Relé', 'Motor', 'Sensor', 'Cableado',
    'Falla de refrigerante', 'Fuga', 'Compresor', 'Condensador', 'Evaporador', 'Capilar', 'Filtro secador', 'Ventilador',
    'Termostato', 'Sensor temp.', 'Control electrónico', 'Deshielo', 'Resistencia',
    'Motor Lavado', 'Bomba', 'Válvula entrada', 'Correa', 'Rodamientos', 'Tambor', 'Resistencia Lav.', 'Centrifugado', 'Otro'
  ];

  listaEstados = [
    'Recibido', 'Diagnóstico', 'Autorización', 'Reparación', 'Reparado', 'No reparable', 'Entregado'
  ];

  constructor(
    private reporteService: ReporteTecnicoService,
    private materialService: MaterialService,
    private clienteService: ClienteService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.cargarReportes();
    this.materialService.getMateriales().subscribe(datos => this.materialesBodega = datos);
    this.clienteService.getClientes().subscribe(datos => this.clientesDirectorio = datos);
  }

  ngAfterViewInit() { this.dataSource.sort = this.sort; }

  aplicarFiltroTexto(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.textoBusqueda = filterValue;
    this.dataSource.filter = filterValue.trim().toLowerCase();
  }

  cargarReportes(): void {
    this.reporteService.getReportes().subscribe(datos => this.dataSource.data = datos);
  }

  obtenerModeloVacio(): ReporteTecnico {
    return {
      fecha: new Date().toISOString().split('T')[0], hora: '', cliente_nombre: '', cliente_direccion: '',
      tecnico: '', equipo: '', color: '', marca: '', numero_serie: '', falla_reportada: '',
      diagnostico_checks: [], detalle_falla: '', pruebas_realizadas: '', diagnostico_txt: '', trabajo_recomendado: '',
      repuestos: [], presupuesto_total: 0, estado_actual: 'Recibido', estados_marcados: ['Recibido']
    };
  }

  toggleFormulario(): void {
    this.mostrarFormulario = !this.mostrarFormulario;
    if (!this.mostrarFormulario) this.cancelarEdicion();
  }

  cancelarEdicion(): void {
    this.modoEdicion = false;
    this.nuevoReporte = this.obtenerModeloVacio();
  }

  editarReporte(reporte: ReporteTecnico): void {
    this.modoEdicion = true;
    this.mostrarFormulario = true;
    this.nuevoReporte = { ...reporte };
    if (!this.nuevoReporte.repuestos) this.nuevoReporte.repuestos = [];
    if (!this.nuevoReporte.diagnostico_checks) this.nuevoReporte.diagnostico_checks = [];
    if (!this.nuevoReporte.estados_marcados) this.nuevoReporte.estados_marcados = ['Recibido'];
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  get clientesFiltrados(): any[] {
    if (!this.filtroClientes) return this.clientesDirectorio;
    return this.clientesDirectorio.filter(c => c.nombre.toLowerCase().includes(this.filtroClientes.toLowerCase()));
  }

  seleccionarCliente(nombreCliente: string): void {
    const cliente = this.clientesDirectorio.find(c => c.nombre === nombreCliente);
    if (cliente) {
      this.nuevoReporte.cliente_direccion = cliente.direccion || '';
    }
  }

  get materialesFiltrados(): Material[] {
    if (!this.filtroMateriales) return this.materialesBodega;
    return this.materialesBodega.filter(m => m.nombre.toLowerCase().includes(this.filtroMateriales.toLowerCase()));
  }

  // 👇 LÓGICA DE CHECKBOXES (Diagnóstico y Estados) 👇
  toggleFalla(falla: string): void {
    const index = this.nuevoReporte.diagnostico_checks.indexOf(falla);
    if (index === -1) {
      this.nuevoReporte.diagnostico_checks.push(falla);
    } else {
      this.nuevoReporte.diagnostico_checks.splice(index, 1);
    }
  }

  toggleEstado(estado: string): void {
    const index = this.nuevoReporte.estados_marcados.indexOf(estado);
    if (index === -1) {
      this.nuevoReporte.estados_marcados.push(estado);
      this.nuevoReporte.estado_actual = estado; // Actualizamos el estado general al último clickeado
    } else {
      this.nuevoReporte.estados_marcados.splice(index, 1);
      // Si desmarcan, asignamos el estado al último de la lista restante
      this.nuevoReporte.estado_actual = this.nuevoReporte.estados_marcados.length > 0 
        ? this.nuevoReporte.estados_marcados[this.nuevoReporte.estados_marcados.length - 1] 
        : 'Recibido';
    }
  }

  // 👇 LÓGICA DE PRESUPUESTO Y BODEGA 👇
  agregarRepuesto(): void {
    this.nuevoReporte.repuestos.push({ id_material: null, cantidad: 1, precio_unitario: 0, subtotal: 0 });
  }

  eliminarRepuesto(index: number): void {
    this.nuevoReporte.repuestos.splice(index, 1);
    this.recalcularPresupuesto();
  }

  seleccionarMaterialBodega(repuesto: RepuestoAsignado): void {
    const material = this.materialesBodega.find(m => m.id_material === repuesto.id_material);
    if (material) {
      repuesto.precio_unitario = Number(material.precio_unitario);
      this.calcularSubtotal(repuesto);
    }
  }

  calcularSubtotal(repuesto: RepuestoAsignado): void {
    repuesto.subtotal = repuesto.cantidad * repuesto.precio_unitario;
    this.recalcularPresupuesto();
  }

  recalcularPresupuesto(): void {
    this.nuevoReporte.presupuesto_total = this.nuevoReporte.repuestos.reduce((acc, rep) => acc + (Number(rep.subtotal) || 0), 0);
  }

  obtenerNombreMaterial(idMaterial: number | null): string {
    if (!idMaterial) return 'Repuesto Manual';
    const material = this.materialesBodega.find(m => m.id_material === idMaterial);
    return material ? material.nombre : 'Material Desconocido';
  }

  guardarReporte(): void {
    if (!this.nuevoReporte.cliente_nombre || !this.nuevoReporte.equipo) {
      this.snackBar.open('⚠️ Faltan datos clave: Cliente y Equipo', 'Cerrar', { duration: 3000 }); return;
    }

    const payload = { ...this.nuevoReporte };
    if (payload.fecha) payload.fecha = new Date(payload.fecha).toISOString().split('T')[0];
    this.guardando = true;

    if (this.modoEdicion && payload.id_reporte) {
      this.reporteService.actualizarReporte(payload.id_reporte, payload).subscribe({
        next: () => {
          this.snackBar.open('✅ Reporte Técnico Actualizado', 'OK', { duration: 4000 });
          this.finalizarGuardado();
        },
        error: () => { this.guardando = false; this.snackBar.open('❌ Error al actualizar', 'Cerrar', { duration: 4000 }); }
      });
    } else {
      this.reporteService.crearReporte(payload).subscribe({
        next: () => {
          this.snackBar.open('✅ Reporte Técnico Creado', 'OK', { duration: 4000 });
          this.finalizarGuardado();
        },
        error: () => { this.guardando = false; this.snackBar.open('❌ Error al guardar', 'Cerrar', { duration: 4000 }); }
      });
    }
  }

  finalizarGuardado(): void {
    this.cargarReportes();
    this.mostrarFormulario = false;
    this.guardando = false;
    this.cancelarEdicion();
  }

  eliminarReporte(reporte: ReporteTecnico): void {
    const confirmacion = confirm(`¿Estás seguro de eliminar el reporte de ${reporte.equipo}? Esta acción no se deshace.`);
    if (confirmacion && reporte.id_reporte) {
      this.reporteService.eliminarReporte(reporte.id_reporte).subscribe({
        next: () => {
          this.snackBar.open('🗑️ Reporte eliminado', 'OK', { duration: 3000 });
          this.cargarReportes();
        }
      });
    }
  }

  imprimirReporte(reporte: ReporteTecnico): void {
    let filasRepuestos = '';
    
    if (reporte.repuestos && reporte.repuestos.length > 0) {
      reporte.repuestos.forEach(rep => {
        filasRepuestos += `
          <tr>
            <td style="padding: 8px; border: 1px solid #ccc;">${this.obtenerNombreMaterial(rep.id_material)}</td>
            <td style="padding: 8px; border: 1px solid #ccc; text-align: center;">${rep.cantidad}</td>
            <td style="padding: 8px; border: 1px solid #ccc; text-align: right;">$${Number(rep.precio_unitario).toFixed(2)}</td>
            <td style="padding: 8px; border: 1px solid #ccc; text-align: right; font-weight: bold;">$${Number(rep.subtotal).toFixed(2)}</td>
          </tr>
        `;
      });
    } else {
      filasRepuestos = `<tr><td colspan="4" style="text-align: center; padding: 10px; color: gray;">Sin repuestos registrados</td></tr>`;
    }

    // Dibujamos la cuadrícula de checks
    let checksImpresion = '<div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; font-size: 11px;">';
    this.listaFallas.forEach(falla => {
      const marcado = reporte.diagnostico_checks.includes(falla) ? '☑' : '☐';
      checksImpresion += `<div>${marcado} ${falla}</div>`;
    });
    checksImpresion += '</div>';

    // Dibujamos los estados
    let estadosImpresion = '<div style="display: flex; gap: 15px; font-size: 12px; font-weight: bold; color: #0288d1; justify-content: center; margin-top: 15px;">';
    this.listaEstados.forEach(estado => {
      const marcado = reporte.estados_marcados.includes(estado) ? '☑' : '☐';
      estadosImpresion += `<div>${marcado} ${estado}</div>`;
    });
    estadosImpresion += '</div>';

    const ventanaImpresion = window.open('', '_blank', 'width=1000,height=800');
    if (ventanaImpresion) {
      ventanaImpresion.document.write(`
        <html>
          <head>
            <title>Reporte Técnico - FRIGORIA</title>
            <style>
              body { font-family: 'Arial', sans-serif; padding: 20px; color: #333; margin: 0; font-size: 12px; }
              .header { text-align: center; margin-bottom: 20px; }
              .header h1 { color: #0288d1; margin: 0; font-size: 22px; text-transform: uppercase; }
              .header p { margin: 2px; font-weight: bold; color: #555; }
              .seccion-titulo { background-color: #0288d1; color: white; padding: 5px 10px; font-weight: bold; margin-top: 15px; margin-bottom: 5px; border-radius: 4px; font-size: 12px; }
              .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
              .info-box { border: 1px solid #ccc; padding: 8px; border-radius: 4px; }
              .info-label { color: #0288d1; font-weight: bold; font-size: 10px; text-transform: uppercase; }
              .info-value { font-size: 13px; font-weight: 500; margin-top: 3px; border-bottom: 1px dashed #ccc; padding-bottom: 2px; }
              table { width: 100%; border-collapse: collapse; margin-top: 5px; }
              th { background-color: #e1f5fe; color: #0288d1; padding: 8px; text-align: center; border: 1px solid #ccc; font-size: 11px; }
              .firmas { display: flex; justify-content: space-around; margin-top: 60px; }
              .firma-linea { width: 200px; border-top: 1px solid #333; text-align: center; padding-top: 5px; font-weight: bold; font-size: 11px; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>FRIGORIA IND.</h1>
              <p>FORMATO DE RECEPCIÓN DE EQUIPOS PARA MANTENIMIENTO / REPARACIÓN</p>
            </div>

            <div class="seccion-titulo">1. DATOS GENERALES</div>
            <div class="info-grid">
              <div class="info-box"><div class="info-label">Fecha / Hora</div><div class="info-value">${reporte.fecha} ${reporte.hora || ''}</div></div>
              <div class="info-box"><div class="info-label">Cliente</div><div class="info-value">${reporte.cliente_nombre}</div></div>
              <div class="info-box"><div class="info-label">Dirección</div><div class="info-value">${reporte.cliente_direccion || 'N/A'}</div></div>
              <div class="info-box"><div class="info-label">Técnico Asignado</div><div class="info-value">${reporte.tecnico || 'N/A'}</div></div>
            </div>

            <div class="seccion-titulo">2. IDENTIFICACIÓN DEL EQUIPO</div>
            <div class="info-grid" style="grid-template-columns: 1fr 1fr 1fr;">
              <div class="info-box"><div class="info-label">Equipo</div><div class="info-value">${reporte.equipo}</div></div>
              <div class="info-box"><div class="info-label">Marca</div><div class="info-value">${reporte.marca || 'N/A'}</div></div>
              <div class="info-box"><div class="info-label">Modelo / Serie</div><div class="info-value">${reporte.numero_serie || 'N/A'}</div></div>
            </div>
            <div class="info-box" style="margin-top: 10px;"><div class="info-label">Color</div><div class="info-value">${reporte.color || 'N/A'}</div></div>
            <div class="info-box" style="margin-top: 10px;"><div class="info-label">Falla Reportada por Cliente</div><div class="info-value">${reporte.falla_reportada || 'Ninguna descrita'}</div></div>

            <div class="seccion-titulo">4. DIAGNÓSTICO TÉCNICO (VERIFICACIÓN / FALLA DETECTADA)</div>
            <div style="border: 1px solid #ccc; padding: 10px; border-radius: 4px;">
              ${checksImpresion}
            </div>

            <div class="seccion-titulo">5. DETALLE DEL DIAGNÓSTICO</div>
            <div class="info-box"><div class="info-label">Detalle de Falla</div><div class="info-value">${reporte.detalle_falla || '...'}</div></div>
            <div class="info-box" style="margin-top: 5px;"><div class="info-label">Pruebas Realizadas</div><div class="info-value">${reporte.pruebas_realizadas || '...'}</div></div>
            <div class="info-box" style="margin-top: 5px;"><div class="info-label">Diagnóstico Final</div><div class="info-value">${reporte.diagnostico_txt || '...'}</div></div>
            <div class="info-box" style="margin-top: 5px;"><div class="info-label">Trabajo Recomendado</div><div class="info-value">${reporte.trabajo_recomendado || '...'}</div></div>

            <div class="seccion-titulo">6. PRESUPUESTO / REPUESTOS REQUERIDOS</div>
            <table>
              <thead><tr><th>REPUESTO / MATERIAL</th><th>CANT.</th><th>P. UNIT.</th><th>SUBTOTAL</th></tr></thead>
              <tbody>${filasRepuestos}</tbody>
            </table>
            <div style="text-align: right; font-size: 18px; font-weight: bold; margin-top: 10px; color: #2e7d32;">
              PRESUPUESTO TOTAL: $${Number(reporte.presupuesto_total).toFixed(2)}
            </div>

            <div class="seccion-titulo">7. ESTADO DEL SERVICIO Y CIERRE</div>
            ${estadosImpresion}

            <div class="firmas">
              <div class="firma-linea">Firma Cliente / Autorización</div>
              <div class="firma-linea">Firma Técnico Responsable</div>
            </div>

            <script>window.onload = function() { setTimeout(function() { window.print(); window.close(); }, 500); };</script>
          </body>
        </html>
      `);
      ventanaImpresion.document.close();
    }
  }
}
