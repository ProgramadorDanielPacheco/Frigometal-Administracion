import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule, MAT_DATE_LOCALE, MatOptionModule } from '@angular/material/core';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';

import { ProformaService } from '../../services/proforma';
import { ProductoService } from '../../services/producto';
import { ClienteService } from '../../services/cliente';
// 👇 NUEVOS IMPORTACIONES 👇
import { RecetaService } from '../../services/receta'; 
import { MaterialService } from '../../services/material';

@Component({
  selector: 'app-proformas',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatFormFieldModule, 
    MatInputModule, MatButtonModule, MatIconModule, MatDatepickerModule, 
    MatNativeDateModule, MatSnackBarModule, MatTableModule, MatOptionModule, MatSelectModule
  ],
  templateUrl: './proformas.html',
  providers: [{ provide: MAT_DATE_LOCALE, useValue: 'es-ES' }]
})
export class ProformasComponent implements OnInit {

  dataSource = new MatTableDataSource<any>([]);
  columnasMostradas: string[] = ['numero_proforma', 'cliente', 'fecha', 'precio_total', 'acciones'];
  
  mostrarFormulario: boolean = false;
  modoEdicion: boolean = false;
  idEditando: number | null = null;

  clientesDirectorio: any[] = [];
  filtroClientes: string = '';
  nuevaProforma: any = this.obtenerModeloVacio();
  productosCatalogo: any[] = [];
  materialesBodega: any[] = []; // 👈 NUEVO: Para saber los precios de la receta
  
  // 👇 NUEVO: Añadimos 'utilidad' inicializada en 30% por defecto (puedes cambiarlo)
  nuevoDetalle: any = { cantidad: 1, id_producto: null, descripcion: '', precio_unitario: 0, utilidad: 30, precio_total: 0 };
  
  constructor(
    private proformaService: ProformaService,
    private productoService: ProductoService, 
    private clienteService: ClienteService,
    private recetaService: RecetaService, // 👈 NUEVO
    private materialService: MaterialService, // 👈 NUEVO
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void { 
    this.cargarProformas(); 
    this.productoService.getProductos().subscribe(res => this.productosCatalogo = res);
    this.cargarClientesDirectorio();
    
    // 👇 Cargamos los materiales al inicio para poder calcular la receta rápido
    this.materialService.getMateriales().subscribe(res => this.materialesBodega = res);
  }

  cargarClientesDirectorio(): void {
    this.clienteService.getClientes().subscribe({
      next: (datos) => this.clientesDirectorio = datos,
      error: (err) => console.error('Error al cargar directorio', err)
    });
  }

  get clientesFiltrados(): any[] {
    if (!this.filtroClientes) return this.clientesDirectorio;
    const filtro = this.filtroClientes.toLowerCase();
    return this.clientesDirectorio.filter(c => 
      c.nombre.toLowerCase().includes(filtro) || 
      c.id_cliente.includes(filtro) ||
      (c.nombre_comercial && c.nombre_comercial.toLowerCase().includes(filtro))
    );
  }

  seleccionarCliente(nombreCliente: string): void {
    const cliente = this.clientesDirectorio.find(c => c.nombre === nombreCliente);
    if (cliente) {
      this.nuevaProforma.cliente_direccion = cliente.direccion || '';
      this.nuevaProforma.ciudad = cliente.ciudad || '';
    }
  }

  cargarProformas(): void {
    this.proformaService.getProformas().subscribe(res => this.dataSource.data = res);
  }

  obtenerModeloVacio() {
    return {
      numero_proforma: '', cliente_nombre: '', cliente_direccion: '', ciudad: '', responsable: '',
      fecha_emision: new Date(), trabajo: '', detalles: [], precio_total: 0,
      garantia: '1 año a partir de la entrega del equipo (La garantia NO cubre daño eléctrico).',
      forma_pago: 'Abono 60% antes de iniciar la obra y 40% antes de la entrega.',
      validez: '15 dias'
    };
  }

  toggleFormulario(): void {
    this.mostrarFormulario = !this.mostrarFormulario;
    if (!this.mostrarFormulario) this.cancelarEdicion();
  }

  cancelarEdicion(): void {
    this.modoEdicion = false;
    this.idEditando = null;
    this.nuevaProforma = this.obtenerModeloVacio();
    this.nuevoDetalle = { cantidad: 1, id_producto: null, descripcion: '', precio_unitario: 0, utilidad: 30, precio_total: 0 };
  }

  editarProforma(proforma: any): void {
    this.modoEdicion = true;
    this.idEditando = proforma.id_proforma;
    this.mostrarFormulario = true;
    
    this.nuevaProforma = { ...proforma };
    if (!this.nuevaProforma.detalles) this.nuevaProforma.detalles = [];
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // ==========================================
  // 👇 CÁLCULO DE COSTOS, UTILIDAD Y PRECIO 👇
  // ==========================================
  seleccionarProductoCatalogo(idProducto: number): void {
    const prod = this.productosCatalogo.find(p => p.id_producto === idProducto);
    if (prod) {
      this.nuevoDetalle.descripcion = prod.nombre;
      
      // Consultamos la receta para armar el costo real
      this.snackBar.open('⏳ Calculando costo desde bodega...', '', { duration: 1500 });
      this.recetaService.getReceta(idProducto).subscribe({
        next: (receta) => {
          let costoTotal = 0;
          
          receta.forEach((r: any) => {
            const materialBD = this.materialesBodega.find(m => m.id_material === r.id_material);
            const precioMat = materialBD ? Number(materialBD.precio_unitario || 0) : 0;
            const cantidadMat = Number(r.cantidad_requerida || r.cantidad_necesaria || 0);
            costoTotal += (cantidadMat * precioMat);
          });
          
          // Asignamos el costo a "precio_unitario" y calculamos la ganancia
          this.nuevoDetalle.precio_unitario = parseFloat(costoTotal.toFixed(2));
          this.calcularTotalLinea();
          this.snackBar.open('✅ Costo de producción cargado', 'OK', { duration: 2000 });
        },
        error: () => {
          this.snackBar.open('⚠️ Producto sin receta. Ingresa el costo manual.', 'Cerrar', { duration: 3000 });
        }
      });
    }
  }

  calcularTotalLinea(): void {
    // 1. Calculamos el costo base (Costo de receta * Cantidad)
    const costoBase = this.nuevoDetalle.cantidad * this.nuevoDetalle.precio_unitario;
    
    // 2. Calculamos cuánto es la ganancia según el porcentaje de utilidad
    const porcentajeUtilidad = this.nuevoDetalle.utilidad / 100;
    const ganancia = costoBase * porcentajeUtilidad;
    
    // 3. El Precio de Venta final (Total)
    this.nuevoDetalle.precio_total = parseFloat((costoBase + ganancia).toFixed(2));
  }

  agregarDetalle(): void {
    if (!this.nuevoDetalle.descripcion) return;
    this.nuevaProforma.detalles.push({ ...this.nuevoDetalle });
    this.recalcularTotalGeneral();
    this.nuevoDetalle = { cantidad: 1, id_producto: null, descripcion: '', precio_unitario: 0, utilidad: 30, precio_total: 0 };
  }

  eliminarDetalle(index: number): void {
    this.nuevaProforma.detalles.splice(index, 1);
    this.recalcularTotalGeneral();
  }

  recalcularTotalGeneral(): void {
    this.nuevaProforma.precio_total = this.nuevaProforma.detalles.reduce((sum: number, det: any) => sum + Number(det.precio_total), 0);
  }

  guardarProforma(): void {
    if (!this.nuevaProforma.numero_proforma || !this.nuevaProforma.cliente_nombre) {
      this.snackBar.open('Faltan datos clave', 'Cerrar'); return;
    }
    
    const payload = { ...this.nuevaProforma };
    if (payload.fecha_emision) payload.fecha_emision = new Date(payload.fecha_emision).toISOString().split('T')[0];

    if (this.modoEdicion && this.idEditando) {
      this.proformaService.actualizarProforma(this.idEditando, payload).subscribe({
        next: () => {
          this.snackBar.open('✅ Proforma Actualizada y OP Sincronizada', 'OK', { duration: 5000 });
          this.mostrarFormulario = false;
          this.cancelarEdicion();
          this.cargarProformas();
        },
        error: (err) => {
          const mensajeError = err.error?.detail || 'Error al actualizar';
          this.snackBar.open(`❌ ${mensajeError}`, 'Cerrar', { duration: 8000 });
        }
      });
    } else {
      this.proformaService.crearProforma(payload).subscribe({
        next: () => {
          this.snackBar.open('✅ Proforma Creada y Borrador de Orden Generado', 'OK', { duration: 5000 });
          this.mostrarFormulario = false;
          this.cancelarEdicion();
          this.cargarProformas();
        },
        error: (err) => {
          const mensajeError = err.error?.detail || 'Error al guardar';
          this.snackBar.open(`❌ ${mensajeError}`, 'Cerrar', { duration: 8000 });
        }
      });
    }
  }

  // ==========================================
  // 👇 LÓGICA DE IMPRESIÓN (FORMATO FÍSICO FRIGOMETAL) 👇
  // ==========================================
  imprimirProforma(proforma: any): void {
    let filasDetalles = '';
    
    // Armamos las filas de la tabla con los detalles
    if (proforma.detalles && proforma.detalles.length > 0) {
      proforma.detalles.forEach((d: any) => {
        filasDetalles += `
          <tr>
            <td style="text-align: left; padding: 10px;">${d.descripcion}</td>
            <td style="text-align: center;">${d.cantidad}</td>
            <td style="text-align: right;">$ ${Number(d.precio_unitario).toFixed(2)}</td>
            <td style="text-align: right; font-weight: bold;">$ ${Number(d.precio_total).toFixed(2)}</td>
          </tr>
        `;
      });
    }

    // Convertimos la fecha a un formato amigable (Ej: 24 de marzo del 2026)
    const fechaObj = new Date(proforma.fecha_emision);
    const opcionesFecha: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'long', year: 'numeric' };
    const fechaFormateada = fechaObj.toLocaleDateString('es-ES', opcionesFecha);

    // Texto del total en letras
    const totalEnLetras = this.numeroALetras(Number(proforma.precio_total));

    const ventanaImpresion = window.open('', '_blank', 'width=1000,height=800');
    if (ventanaImpresion) {
      ventanaImpresion.document.write(`
        <html>
          <head>
            <title>Proforma - ${proforma.numero_proforma}</title>
            <style>
              @page { size: A4 portrait; margin: 1cm; }
              body { font-family: 'Arial', sans-serif; padding: 0; margin: 0; color: #333; font-size: 13px; }
              
              /* Encabezado */
              .header-container { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #1976d2; padding-bottom: 10px; margin-bottom: 15px; }
              .logo-section { display: flex; align-items: center; gap: 15px; }
              .logo-section img { height: 70px; }
              .company-info h1 { margin: 0; color: #1976d2; font-size: 24px; font-weight: bold; font-style: italic; }
              .company-info p { margin: 2px 0; font-size: 11px; color: #555; }
              .contact-info { text-align: right; font-size: 12px; }
              .contact-info p { margin: 3px 0; display: flex; align-items: center; justify-content: flex-end; gap: 5px; }

              /* Datos del Cliente */
              .client-box { background-color: #f9f9f9; border: 1px solid #ccc; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
              .client-row { display: flex; margin-bottom: 5px; }
              .client-label { font-weight: bold; width: 140px; color: #1976d2; }
              .client-value { flex: 1; border-bottom: 1px dashed #ccc; }

              /* Tabla de Detalles */
              table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
              th { background-color: #1976d2; color: white; padding: 10px; text-align: center; font-size: 12px; border: 1px solid #0d47a1; }
              td { border: 1px solid #ccc; padding: 8px; }
              .table-striped tr:nth-child(even) { background-color: #f2f2f2; }

              /* Resumen Totales y Condiciones */
              .summary-container { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 12px; }
              .conditions { width: 65%; }
              .conditions p { margin: 5px 0; }
              .totals { width: 30%; border: 1px solid #ccc; border-radius: 5px; padding: 10px; background-color: #f9f9f9; }
              .totals-row { display: flex; justify-content: space-between; margin-bottom: 5px; font-weight: bold; font-size: 16px; }

              /* Footer e Info Bancaria */
              .footer-grid { display: flex; justify-content: space-between; border-top: 2px solid #1976d2; padding-top: 15px; font-size: 11px; }
              .footer-col { width: 30%; }
              .footer-col h4 { margin: 0 0 5px 0; color: #1976d2; font-size: 12px; }
              .footer-col p { margin: 2px 0; }
              .note-box { font-style: italic; font-size: 10px; color: #666; margin-top: 10px; text-align: justify; }

              /* Firmas */
              .signatures { display: flex; justify-content: space-around; margin-top: 50px; }
              .sig-line { width: 200px; border-top: 1px solid #333; text-align: center; padding-top: 5px; font-weight: bold; }

              @media print {
                body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              }
            </style>
          </head>
          <body>
            
            <!-- Encabezado -->
            <div class="header-container">
              <div class="logo-section">
                <img src="/logo.png" alt="Logo FrigoMetal" onerror="this.style.display='none'">
                <div class="company-info">
                  <h1>FRIGO METAL</h1>
                  <p>Construcción, Mantenimiento y Reparación de Equipos Frigoríficos</p>
                </div>
              </div>
              <div class="contact-info">
                <p>✉️ frigometalcuenca@gmail.com</p>
                <p>📷 @frigometal_cuenca</p>
              </div>
            </div>

            <!-- Datos del Cliente -->
            <div class="client-box">
              <div class="client-row"><div class="client-label">CLIENTE:</div><div class="client-value">${proforma.cliente_nombre}</div></div>
              <div class="client-row"><div class="client-label">DIRECCIÓN:</div><div class="client-value">${proforma.cliente_direccion || 'N/A'}</div></div>
              <div class="client-row"><div class="client-label">FECHA DE EMISIÓN:</div><div class="client-value">${fechaFormateada}</div></div>
              <div class="client-row"><div class="client-label">TRABAJO:</div><div class="client-value">${proforma.trabajo || 'Fabricación de Equipos'}</div></div>
            </div>

            <!-- Tabla -->
            <table class="table-striped">
              <thead>
                <tr>
                  <th style="width: 55%;">DESCRIPCIÓN</th>
                  <th style="width: 10%;">CANT.</th>
                  <th style="width: 15%;">P. UNITARIO</th>
                  <th style="width: 20%;">P. TOTAL</th>
                </tr>
              </thead>
              <tbody>
                ${filasDetalles}
              </tbody>
            </table>

            <!-- Condiciones y Total -->
            <div class="summary-container">
              <div class="conditions">
                <p><b>SON:</b> ${totalEnLetras} (Estos valores Incluyen I.V.A)</p>
                <p><b>GARANTÍA:</b> ${proforma.garantia}</p>
                <p><b>FORMA DE PAGO:</b> ${proforma.forma_pago}</p>
                <p style="color: #d32f2f; margin-top: 10px;"><b>NOTA:</b> Esta proforma tiene validez de ${proforma.validez}.</p>
              </div>
              <div class="totals">
                <div class="totals-row" style="color: #1976d2; font-size: 18px;">
                  <span>TOTAL</span>
                  <span>$ ${Number(proforma.precio_total).toFixed(2)}</span>
                </div>
              </div>
            </div>

            <!-- Información General y Bancaria -->
            <div class="footer-grid">
              <div class="footer-col">
                <h4>FRIGOMETAL CIA. LTDA.</h4>
                <p><b>RUC:</b> 0195128121001</p>
                <p><b>Matriz:</b> Unidad Nacional 5-44 y Malvinas</p>
                <p><b>Taller:</b> Castilla Cruz - Vía al Valle</p>
                <p style="margin-top: 8px; font-weight: bold; font-size: 12px; color: red;">${proforma.numero_proforma || 'S/N'}</p>
              </div>
              <div class="footer-col">
                <p><b>CIUDAD:</b> ${proforma.ciudad || 'Cuenca'}</p>
                <p><b>RESPONSABLE:</b> ${proforma.responsable || 'Ventas'}</p>
              </div>
              <div class="footer-col">
                <h4>DATOS PARA TRANSFERENCIAS:</h4>
                <p><b>BANCO DEL AUSTRO</b></p>
                <p>Cuenta Corriente #0700360636</p>
                <p><b>Nombre:</b> FrigoMetal Cia. Ltda.</p>
                <p><b>RUC:</b> 0195128121001</p>
              </div>
            </div>

            <!-- Nota Legal -->
            <div class="note-box">
              NOTA: Todas las mercancías despachadas por Frigo Metal seguirán siendo de nuestra propiedad hasta la cancelación total de las facturas y posibles saldos pendientes a nuestro favor que con ellas se relacionen.
            </div>

            <!-- Firmas -->
            <div class="signatures">
              <div class="sig-line">ENTREGADO POR:</div>
              <div class="sig-line">RECIBIDO POR:</div>
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

  // 👇 LÓGICA DE NÚMEROS A LETRAS PARA EL TOTAL 👇
  numeroALetras(num: number): string {
    if (num === 0) return 'Cero dólares con 00/100 ctvs';
    
    const unidades = ['', 'un', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
    const decenas = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiun', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
    const decenasPuras = ['', 'diez', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    const centenas = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

    function convertirGrupo(n: number): string {
      let output = '';
      if (n === 100) return 'cien';
      if (n > 99) { output += centenas[Math.floor(n / 100)] + ' '; n %= 100; }
      if (n > 9 && n < 30) { output += decenas[n - 10] + ' '; return output; }
      if (n > 29) { output += decenasPuras[Math.floor(n / 10)] + ' '; n %= 10; if (n > 0) output += 'y '; }
      if (n > 0) output += unidades[n] + ' ';
      return output;
    }

    const enteros = Math.floor(num);
    const centavos = Math.round((num - enteros) * 100);
    
    let letras = '';
    let miles = Math.floor(enteros / 1000);
    let resto = enteros % 1000;

    if (miles > 0) {
      if (miles === 1) letras += 'mil ';
      else letras += convertirGrupo(miles) + 'mil ';
    }
    if (resto > 0) letras += convertirGrupo(resto);

    letras = letras.trim();
    letras = letras.charAt(0).toUpperCase() + letras.slice(1); // Mayúscula inicial

    return `${letras} dolares con ${centavos.toString().padStart(2, '0')}/100 ctvs`;
  }
}