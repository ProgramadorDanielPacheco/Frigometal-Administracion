import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { KpiService } from '../../services/kpi'; 

import { Chart, registerables } from 'chart.js';
import annotationPlugin from 'chartjs-plugin-annotation';
import { MatOptionModule } from '@angular/material/core';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon'; // 👈 AÑADIR ESTO

// 👇 MAGIA 1: CARGAMOS EL LOGO PARA LA MARCA DE AGUA 👇
const logoFrigometal = new Image();
logoFrigometal.src = '/logo.png'; 

const watermarkPlugin = {
  id: 'watermark',
  beforeDraw: (chart: any) => {
    if (logoFrigometal.complete && logoFrigometal.naturalHeight !== 0) {
      const { ctx, chartArea: { top, left, width, height } } = chart;
      ctx.save();
      ctx.globalAlpha = 0.15; // 15% de opacidad
      
      const imgWidth = width * 0.4; // El logo ocupará el 40% del ancho del gráfico
      const imgHeight = (logoFrigometal.height / logoFrigometal.width) * imgWidth;
      
      const x = left + (width - imgWidth) / 2; // Centrado horizontal
      const y = top + (height - imgHeight) / 2; // Centrado vertical
      
      ctx.drawImage(logoFrigometal, x, y, imgWidth, imgHeight);
      ctx.restore();
    }
  }
};

// Registramos ambos plugins
Chart.register(...registerables, annotationPlugin, watermarkPlugin);

@Component({
  selector: 'app-estadisticas',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatCardModule, MatFormFieldModule, 
    MatInputModule, MatButtonModule, MatSnackBarModule, MatOptionModule, MatSelectModule, MatIconModule
  ],
  templateUrl: './estadisticas.html'
})
export class EstadisticasComponent implements OnInit {

  anioActual: number = new Date().getFullYear();
  
  semanaIngresos: number = 0;
  semanaProductividad: number = 0;
  semanaVentas: number = 0;
  semanaGastos: number = 0; // 👈 NUEVO

  semanaCuentas: number = 0;
  formCuentas = { meta: 0, nombre_persona: '', monto: 0, tipo_movimiento: 'Deuda' }; // 👈 AÑADIDO // 👈 Incluye nombre_persona
  graficoCuentas: any;
  historialCuentas: any[] = [];
  anchoGraficoCuentas: string = '100%';
  anchoGraficoAbonos: string = '100%';
  
  formIngresos = { meta: 0, ingresos: 0, egresos: 0 };
  formProductividad = { meta_planchas: 0, planchas_usadas: 0 };
  formVentas = { meta: 0, ingresos: 0 };
  formGastos = { meta: 0, gastos: 0 }; // 👈 NUEVO

  graficoIngresos: any;
  graficoProductividad: any;
  graficoVentas: any;
  graficoGastos: any; // 👈 NUEVO
  graficoAbonos: any;

  historialIngresos: any[] = [];
  historialProductividad: any[] = [];
  historialVentas: any[] = [];
  historialGastos: any[] = []; // 👈 NUEVO

  // ==========================================
  // 👇 PLUGIN CORREGIDO: DIBUJO INTELIGENTE DE NÚMEROS 👇
  // ==========================================
  // ==========================================
  // 👇 PLUGIN CORREGIDO: NÚMEROS NEGROS EN BARRAS NEGATIVAS 👇
  // ==========================================
  textOnTopPlugin = {
    id: 'textOnTop',
    afterDatasetsDraw(chart: any) {
      const { ctx, chartArea } = chart; 
      
      chart.data.datasets.forEach((dataset: any, i: number) => {
        const meta = chart.getDatasetMeta(i);
        meta.data.forEach((bar: any, index: number) => {
          let data = dataset.data[index];
          if (data === null || data === undefined) return; 

          ctx.font = 'bold 12px Roboto';
          ctx.textAlign = 'center';
          
          const espacioDisponibleSobreBarra = bar.y - chartArea.top;
          const margenNecesario = 20; 

          let yPos;
          
          if (data < 0) {
            // 1. Barras negativas: Texto AFUERA (debajo de la barra)
            yPos = bar.y + 15;
            ctx.fillStyle = '#333'; // 👈 CORRECCIÓN: Volvemos al gris oscuro/negro
          } else if (espacioDisponibleSobreBarra < margenNecesario) {
            // 2. Barras positivas MUY ALTAS: Texto ADENTRO
            yPos = bar.y + 15;
            ctx.fillStyle = '#333'; // Blanco para contraste dentro de la barra verde gigante
          } else {
            // 3. Barras positivas normales: Texto AFUERA
            yPos = bar.y - 8;
            ctx.fillStyle = '#333'; // Gris oscuro/negro
          }

          let valorRedondeado = Number(data) % 1 === 0 ? data : Number(data).toFixed(2);
          const texto = dataset.label.includes('$') ? `$${valorRedondeado}` : valorRedondeado;
          
          ctx.fillText(texto, bar.x, yPos);
        });
      });
    }
  };

  constructor(private kpiService: KpiService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    const semActual = this.calcularSemanaDelAno(new Date());
    this.semanaIngresos = semActual;
    this.semanaProductividad = semActual;
    this.semanaVentas = semActual;
    this.semanaGastos = semActual;
    this.semanaCuentas = semActual;
    this.cargarGraficos();
  }

  calcularSemanaDelAno(fecha: Date): number {
    const primerDiaAno = new Date(fecha.getFullYear(), 0, 1);
    const dias = Math.floor((fecha.getTime() - primerDiaAno.getTime()) / (24 * 60 * 60 * 1000));
    return Math.ceil((fecha.getDay() + 1 + dias) / 7);
  }

  // MÉTODOS DE BÚSQUEDA...
  buscarIngresosPorSemana(): void {
    const data = this.historialIngresos.find(d => d.semana === this.semanaIngresos);
    this.formIngresos = data ? { meta: data.meta, ingresos: data.ingresos, egresos: data.egresos } : { meta: this.historialIngresos.length ? this.historialIngresos[this.historialIngresos.length - 1].meta : 0, ingresos: 0, egresos: 0 };
  }

  buscarProductividadPorSemana(): void {
    const data = this.historialProductividad.find(d => d.semana === this.semanaProductividad);
    this.formProductividad = data ? { meta_planchas: data.meta_planchas, planchas_usadas: data.planchas_usadas } : { meta_planchas: this.historialProductividad.length ? this.historialProductividad[this.historialProductividad.length - 1].meta_planchas : 0, planchas_usadas: 0 };
  }

  buscarVentasPorSemana(): void {
    const data = this.historialVentas.find(d => d.semana === this.semanaVentas);
    this.formVentas = data ? { meta: data.meta, ingresos: data.ingresos } : { meta: this.historialVentas.length ? this.historialVentas[this.historialVentas.length - 1].meta : 0, ingresos: 0 };
  }

  buscarGastosPorSemana(): void { // 👈 NUEVO
    const data = this.historialGastos.find(d => d.semana === this.semanaGastos);
    this.formGastos = data ? { meta: data.meta, gastos: data.gastos } : { meta: this.historialGastos.length ? this.historialGastos[this.historialGastos.length - 1].meta : 0, gastos: 0 };
  }

  buscarCuentasPorSemana(): void {
    const data = this.historialCuentas.find(d => d.semana === this.semanaCuentas);
    // Solo autocompletamos la Meta. Dejamos el nombre y el monto vacíos para que sea fácil agregar a otra persona.
    if (data) {
      this.formCuentas.meta = data.meta;
    } else {
      this.formCuentas.meta = this.historialCuentas.length ? this.historialCuentas[this.historialCuentas.length - 1].meta : 0;
    }
  }

  cargarGraficos(): void {
    // 1. INGRESOS
    this.kpiService.getIngresos().subscribe(datos => {
      this.historialIngresos = datos; this.buscarIngresosPorSemana();
      if (datos.length === 0) return;
      const labels = datos.map(d => `Sem ${d.semana}`);
      const netos = datos.map(d => Number(d.neto));
      const metaFija = datos[datos.length - 1].meta;
      const colores: string[] = datos.map(d => Number(d.neto) < Number(d.meta) ? 'rgba(244, 67, 54, 0.8)' : (Number(d.neto) === Number(d.meta) ? 'rgba(255, 193, 7, 0.8)' : 'rgba(76, 175, 80, 0.8)'));
      
      const acumulado = parseFloat((datos.reduce((a, c) => a + Number(c.ingresos), 0) - datos.reduce((a, c) => a + Number(c.egresos), 0)).toFixed(2));
      labels.push('ACUMULADO'); netos.push(acumulado);
      colores.push(acumulado < metaFija ? 'rgba(244, 67, 54, 1)' : (acumulado === metaFija ? 'rgba(255, 193, 7, 1)' : 'rgba(76, 175, 80, 1)'));

      if (this.graficoIngresos) this.graficoIngresos.destroy();
      this.graficoIngresos = new Chart('canvasIngresos', {
        type: 'bar', data: { labels, datasets: [{ label: 'Ingreso Neto ($)', data: netos, backgroundColor: colores, borderColor: colores.map(c=>c.replace('0.8','1')), borderWidth: 2, barThickness: 'flex', maxBarThickness: 90 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, annotation: { annotations: { linea: { type: 'line', yMin: metaFija, yMax: metaFija, borderColor: '#333', borderWidth: 3, borderDash: [6,6], label: { content: `META SEMANAL: $${metaFija}`, display: true, position: 'start', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white' } } } } } },
        plugins: [this.textOnTopPlugin] 
      });
    });

    // 2. PRODUCTIVIDAD
    this.kpiService.getProductividad().subscribe(datos => {
      this.historialProductividad = datos; this.buscarProductividadPorSemana();
      if (datos.length === 0) return;
      const labels = datos.map(d => `Sem ${d.semana}`);
      const usadas = datos.map(d => d.planchas_usadas);
      const metaFija = datos[datos.length - 1].meta_planchas;
      const colores = datos.map(d => Number(d.planchas_usadas) < Number(d.meta_planchas) ? 'rgba(244, 67, 54, 0.8)' : (Number(d.planchas_usadas) === Number(d.meta_planchas) ? 'rgba(255, 193, 7, 0.8)' : 'rgba(76, 175, 80, 0.8)'));

      if (this.graficoProductividad) this.graficoProductividad.destroy();
      this.graficoProductividad = new Chart('canvasProductividad', {
        type: 'bar', data: { labels, datasets: [{ label: 'Planchas Usadas', data: usadas, backgroundColor: colores, borderColor: colores.map(c=>c.replace('0.8','1')), borderWidth: 1, barThickness: 'flex', maxBarThickness: 90 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, annotation: { annotations: { linea: { type: 'line', yMin: metaFija, yMax: metaFija, borderColor: '#333', borderWidth: 3, borderDash: [6,6], label: { content: `META: ${metaFija}`, display: true, position: 'end', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white' } } } } } },
        plugins: [this.textOnTopPlugin] 
      });
    });

    // 3. VENTAS
    this.kpiService.getVentas().subscribe(datos => {
      this.historialVentas = datos; this.buscarVentasPorSemana();
      if (datos.length === 0) return;
      const labels = datos.map(d => `Sem ${d.semana}`);
      const ingresos = datos.map(d => Number(d.ingresos));
      const metaFija = datos[datos.length - 1].meta;
      const colores: string[] = datos.map(d => Number(d.ingresos) < Number(d.meta) ? 'rgba(244, 67, 54, 0.8)' : (Number(d.ingresos) === Number(d.meta) ? 'rgba(255, 193, 7, 0.8)' : 'rgba(76, 175, 80, 0.8)'));
      
      const acumulado = parseFloat(datos.reduce((a, c) => a + Number(c.ingresos), 0).toFixed(2));
      labels.push('ACUMULADO'); ingresos.push(acumulado);
      colores.push(acumulado < metaFija ? 'rgba(244, 67, 54, 1)' : (acumulado === metaFija ? 'rgba(255, 193, 7, 1)' : 'rgba(76, 175, 80, 1)'));

      if (this.graficoVentas) this.graficoVentas.destroy();
      this.graficoVentas = new Chart('canvasVentas', {
        type: 'bar', data: { labels, datasets: [{ label: 'Ingreso Ventas ($)', data: ingresos, backgroundColor: colores, borderColor: colores.map(c=>c.replace('0.8','1')), borderWidth: 2, barThickness: 'flex', maxBarThickness: 90 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, annotation: { annotations: { linea: { type: 'line', yMin: metaFija, yMax: metaFija, borderColor: '#333', borderWidth: 3, borderDash: [6,6], label: { content: `META SEMANAL: $${metaFija}`, display: true, position: 'start', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white' } } } } } },
        plugins: [this.textOnTopPlugin] 
      });
    });

    // ==========================================
    // 4. GRÁFICO DE GASTOS (NUEVO CON LÓGICA INVERSA)
    // ==========================================
    this.kpiService.getGastos().subscribe(datos => {
      this.historialGastos = datos; this.buscarGastosPorSemana();
      if (datos.length === 0) return;

      const labels = datos.map(d => `Sem ${d.semana}`);
      const gastosArr = datos.map(d => Number(d.gastos));
      const metaFija = datos[datos.length - 1].meta;

      // 👇 LÓGICA INVERSA DE COLORES 👇
      const colores: string[] = datos.map(d => {
        if (Number(d.gastos) > Number(d.meta)) return 'rgba(244, 67, 54, 0.8)'; // Malo (Rojo)
        if (Number(d.gastos) === Number(d.meta)) return 'rgba(255, 193, 7, 0.8)'; // Al límite (Amarillo)
        return 'rgba(76, 175, 80, 0.8)'; // Bueno (Verde)
      });
      
      const acumulado = parseFloat(datos.reduce((a, c) => a + Number(c.gastos), 0).toFixed(2));
      labels.push('ACUMULADO'); gastosArr.push(acumulado);
      
      // Evaluamos el acumulado con la lógica inversa
      if (acumulado > metaFija) { colores.push('rgba(244, 67, 54, 1)'); } 
      else if (acumulado === metaFija) { colores.push('rgba(255, 193, 7, 1)'); } 
      else { colores.push('rgba(76, 175, 80, 1)'); }

      if (this.graficoGastos) this.graficoGastos.destroy();
      this.graficoGastos = new Chart('canvasGastos', {
        type: 'bar', data: { labels, datasets: [{ label: 'Control Gastos ($)', data: gastosArr, backgroundColor: colores, borderColor: colores.map(c=>c.replace('0.8','1')), borderWidth: 2, barThickness: 'flex', maxBarThickness: 90 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, annotation: { annotations: { linea: { type: 'line', yMin: metaFija, yMax: metaFija, borderColor: '#333', borderWidth: 3, borderDash: [6,6], label: { content: `LÍMITE GASTO: $${metaFija}`, display: true, position: 'start', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white' } } } } } },
        plugins: [this.textOnTopPlugin] 
      });
    });

    // ==========================================
    // 5. GRÁFICO DE CUENTAS POR COBRAR (SALDOS HISTÓRICOS)
    // ==========================================
    this.kpiService.getCuentasCobrar().subscribe(datos => {
      this.historialCuentas = datos; this.buscarCuentasPorSemana();
      if (datos.length === 0) return;

      // 👇 1. AGRUPAMOS POR SEMANA Y PERSONA PARA CONSOLIDAR LOS MOVIMIENTOS 👇
      const movimientosSemanales: { [key: string]: { semana: number, nombre: string, neto: number, esCorreccion: boolean, valorCorreccion: number, meta: number } } = {};

      datos.forEach(d => {
        const nombreLimpio = d.nombre_persona.toUpperCase().trim();
        const key = `${d.semana}-${nombreLimpio}`;
        const monto = Number(d.monto);

        if (!movimientosSemanales[key]) {
          movimientosSemanales[key] = { semana: d.semana, nombre: d.nombre_persona, neto: 0, esCorreccion: false, valorCorreccion: 0, meta: Number(d.meta) };
        }

        // Si en la misma semana hay varios movimientos, los evaluamos:
        if (d.tipo_movimiento === 'Correccion') {
          movimientosSemanales[key].esCorreccion = true;
          movimientosSemanales[key].valorCorreccion = monto;
        } else if (d.tipo_movimiento === 'Abono') {
          movimientosSemanales[key].neto -= monto;
        } else {
          // Deuda
          movimientosSemanales[key].neto += monto;
        }
      });

      // 👇 2. ORDENAMOS CRONOLÓGICAMENTE PARA SIMULAR LA CALCULADORA 👇
      const datosConsolidados = Object.values(movimientosSemanales).sort((a, b) => a.semana - b.semana);

      // 👇 3. CALCULAMOS EL SALDO ARRASTRADO (LA MAGIA) 👇
      let saldosPorPersona: { [key: string]: number } = {};
      const barrasParaGrafico: { label: string[], saldo: number, meta: number }[] = [];

      datosConsolidados.forEach(mov => {
        const nombre = mov.nombre.toUpperCase().trim();
        
        if (!saldosPorPersona[nombre]) {
          saldosPorPersona[nombre] = 0;
        }

        // Aplicamos la matemática
        if (mov.esCorreccion) {
          saldosPorPersona[nombre] = mov.valorCorreccion; // Seteo exacto
        } else {
          saldosPorPersona[nombre] += mov.neto; // Suma (Deuda) o Resta (Abono)
          if (saldosPorPersona[nombre] < 0) saldosPorPersona[nombre] = 0; // Evitamos saldos ilógicos
        }

        // Guardamos LA FOTO del saldo en esta semana para el gráfico
        barrasParaGrafico.push({
          label: [`Sem ${mov.semana}`, mov.nombre],
          saldo: parseFloat(saldosPorPersona[nombre].toFixed(2)),
          meta: mov.meta
        });
      });

      // 👇 4. PREPARAMOS LOS DATOS PARA CHART.JS 👇
      const labels = barrasParaGrafico.map(b => b.label);
      const montosArr = barrasParaGrafico.map(b => b.saldo);
      const metaFija = datos.length > 0 ? datos[datos.length - 1].meta : 0;

      const colores: string[] = barrasParaGrafico.map(b => {
        if (b.saldo === 0) return 'rgba(158, 158, 158, 0.8)'; // Gris si la cuenta quedó en $0
        if (b.saldo > b.meta) return 'rgba(244, 67, 54, 0.8)'; // Rojo
        if (b.saldo === b.meta) return 'rgba(255, 193, 7, 0.8)'; // Amarillo
        return 'rgba(76, 175, 80, 0.8)'; // Verde
      });

      // 👇 5. CARTERA VIVA GLOBAL (El acumulado real actual) 👇
      const acumuladoReal = Object.values(saldosPorPersona).reduce((a, b) => a + b, 0);
      const netoAcumulado = parseFloat(acumuladoReal.toFixed(2));

      labels.push(['ACUMULADO', 'DEUDA VIVA']);
      montosArr.push(netoAcumulado);
      
      if (netoAcumulado > metaFija) { colores.push('rgba(244, 67, 54, 1)'); } 
      else if (netoAcumulado === metaFija) { colores.push('rgba(255, 193, 7, 1)'); } 
      else { colores.push('rgba(76, 175, 80, 1)'); }

      // Dibujamos con el ancho dinámico
      const anchoCalculado = labels.length * 70;
      this.anchoGraficoCuentas = anchoCalculado > 1000 ? `${anchoCalculado}px` : '100%';
      
      setTimeout(() => {
        if (this.graficoCuentas) this.graficoCuentas.destroy();
        this.graficoCuentas = new Chart('canvasCuentas', {
          type: 'bar', 
          data: { labels, datasets: [{ label: 'Saldo Deuda ($)', data: montosArr, backgroundColor: colores, borderColor: colores.map(c=>c.replace('0.8','1')), borderWidth: 2, barThickness: 'flex', maxBarThickness: 90 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, annotation: { annotations: { linea: { type: 'line', yMin: metaFija, yMax: metaFija, borderColor: '#333', borderWidth: 3, borderDash: [6,6], label: { content: `LÍMITE DEUDA: $${metaFija}`, display: true, position: 'start', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white' } } } } } },
          plugins: [this.textOnTopPlugin] 
        });
      }, 0);
    });
  }

  // MÉTODOS DE GUARDADO
  guardarIngresos(): void { this.kpiService.guardarIngresos({ semana: this.semanaIngresos, anio: this.anioActual, ...this.formIngresos }).subscribe(() => { this.snackBar.open(`✅ Guardado`, 'OK', { duration: 3000 }); this.cargarGraficos(); }); }
  guardarProductividad(): void { this.kpiService.guardarProductividad({ semana: this.semanaProductividad, anio: this.anioActual, ...this.formProductividad }).subscribe(() => { this.snackBar.open(`✅ Guardado`, 'OK', { duration: 3000 }); this.cargarGraficos(); }); }
  guardarVentas(): void { this.kpiService.guardarVentas({ semana: this.semanaVentas, anio: this.anioActual, ...this.formVentas }).subscribe(() => { this.snackBar.open(`✅ Guardado`, 'OK', { duration: 3000 }); this.cargarGraficos(); }); }
  
  guardarGastos(): void { // 👈 NUEVO
    this.kpiService.guardarGastos({ semana: this.semanaGastos, anio: this.anioActual, ...this.formGastos }).subscribe(() => { 
      this.snackBar.open(`✅ Gastos Sem. ${this.semanaGastos} registrados con éxito`, 'OK', { duration: 3000 }); 
      this.cargarGraficos(); 
    }); 
  }

  // 👇 NUEVA FUNCIÓN: Calcula cuánto debe exactamente el cliente hasta HOY 👇
  obtenerSaldoActualCliente(nombreCliente: string): number {
    let saldo = 0;
    const nombreLimpio = nombreCliente.toUpperCase().trim();
    
    // Ordenamos el historial para recorrerlo cronológicamente
    const historialOrdenado = [...this.historialCuentas].sort((a, b) => a.semana - b.semana);

    historialOrdenado.forEach(d => {
      if (d.nombre_persona.toUpperCase().trim() === nombreLimpio) {
        const monto = Number(d.monto);
        if (d.tipo_movimiento === 'Correccion') {
          saldo = monto; // Se sobreescribe
        } else if (d.tipo_movimiento === 'Abono') {
          saldo -= monto; // Se resta
          if (saldo < 0) saldo = 0;
        } else {
          saldo += monto; // Se suma
        }
      }
    });
    
    return saldo;
  }

  guardarCuentas(): void { 
    const nombre = this.formCuentas.nombre_persona.trim();
    const montoIngresado = Number(this.formCuentas.monto);

    if(!nombre) {
      this.snackBar.open(`⚠️ Ingresa el nombre del cliente`, 'OK', { duration: 3000 }); 
      return;
    }

    if (montoIngresado <= 0) {
      this.snackBar.open(`⚠️ El monto debe ser mayor a 0`, 'OK', { duration: 3000 }); 
      return;
    }

    // 1. Averiguamos cuánto debe este cliente en este momento
    const saldoActual = this.obtenerSaldoActualCliente(nombre);

    // ==========================================
    // 👇 2. EL GUARDIA DE SEGURIDAD (VALIDACIONES) 👇
    // ==========================================
    if (this.formCuentas.tipo_movimiento === 'Deuda') {
      
      // CASO 1: Intentan registrar exactamente lo mismo que ya debe (Semana 13 debe $15 -> Semana 14 registran $15 de nuevo)
      if (saldoActual > 0 && montoIngresado === saldoActual) {
        this.snackBar.open(`✋ ${nombre} ya debe $${saldoActual}. Si no sacó nada nuevo, NO registres nada. El sistema ya lo sabe.`, 'Entendido', { duration: 7000 });
        return; // 🛑 Detenemos el guardado
      }

      // CASO 2: El cliente debía $100, pagó $50 y el usuario intenta registrar el saldo ($50) como una nueva Deuda.
      if (saldoActual > 0 && montoIngresado < saldoActual) {
         const mensaje = `⚠️ CUIDADO: ${nombre} ya debe $${saldoActual}.\n\nSi guardas esto como DEUDA, se sumará y deberá$${saldoActual + montoIngresado}.\n\n¿Su saldo REAL es $${montoIngresado}?\nSi es así, cancela esto y usa la opción "Corregir Total (=)".\n\n¿Deseas continuar y SUMARLOS de todas formas?`;
         
         const confirmacion = confirm(mensaje);
         if (!confirmacion) {
           return; // 🛑 Detenemos el guardado si el usuario se da cuenta de su error
         }
      }
    }

    // Si todo está correcto o el usuario confirmó la advertencia, guardamos en la Base de Datos
    this.kpiService.guardarCuentasCobrar({ semana: this.semanaCuentas, anio: this.anioActual, ...this.formCuentas }).subscribe(() => { 
      this.snackBar.open(`✅ Cuenta de ${nombre} registrada`, 'OK', { duration: 3000 }); 
      
      // Limpiamos solo el nombre y el monto
      this.formCuentas.nombre_persona = '';
      this.formCuentas.monto = 0;
      this.cargarGraficos(); 
    }); 
  }

  // ==========================================
  // LÓGICA DE IMPRESIÓN DE GRÁFICOS
  // ==========================================
  imprimirGrafico(canvasId: string, titulo: string): void {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      this.snackBar.open('⚠️ No se encontró el gráfico para imprimir', 'Cerrar', { duration: 3000 });
      return;
    }

    // Tomamos una "foto" en alta calidad del gráfico
    const dataUrl = canvas.toDataURL('image/png', 1.0);

    // Abrimos una ventana emergente para la impresión
    const ventanaImpresion = window.open('', '_blank', 'width=1000,height=700');
    if (ventanaImpresion) {
      ventanaImpresion.document.write(`
        <html>
          <head>
            <title>Imprimir - ${titulo}</title>
            <style>
              body { font-family: 'Roboto', sans-serif; text-align: center; margin: 0; padding: 20px; background: white; }
              .header { margin-bottom: 30px; }
              h2 { color: #333; margin: 0; font-size: 24px; text-transform: uppercase; }
              p { color: #666; margin-top: 5px; }
              img { max-width: 100%; height: auto; border: 1px solid #ddd; border-radius: 8px; }
              /* Forzamos a que la hoja se imprima en horizontal (Landscape) */
              @media print {
                @page { size: landscape; margin: 1cm; }
                body { padding: 0; }
                img { border: none; }
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>${titulo}</h2>
              <p>Frigometal Cia. Ltda. - Reporte Generado el ${new Date().toLocaleDateString('es-ES')}</p>
            </div>
            <img src="${dataUrl}" alt="${titulo}" />
            <script>
              // Esperamos un momento a que la imagen cargue bien y lanzamos la impresión
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  window.close();
                }, 300);
              };
            </script>
          </body>
        </html>
      `);
      ventanaImpresion.document.close();
    }
  }
}