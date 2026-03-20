from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from datetime import date
from typing import List
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date, time
# ==========================
# ESQUEMAS PARA USUARIOS
# ==========================
class UsuarioBase(BaseModel):
    id_usuario: str # 👈 ¡ESTE ES EL QUE FALTABA!
    nombre: str
    correo: EmailStr 
    rol: str
    horas_maximas_semanales: Optional[int] = 40
    activo: Optional[bool] = True

class UsuarioCreate(UsuarioBase):
    password: str 

class UsuarioResponse(UsuarioBase):
    # Ya no necesitamos poner id_usuario aquí abajo porque lo hereda de UsuarioBase
    class Config:
        from_attributes = True

class UsuarioUpdate(BaseModel):
    nombre: Optional[str] = None
    correo: Optional[EmailStr] = None
    rol: Optional[str] = None
    horas_maximas_semanales: Optional[int] = None
    activo: Optional[bool] = None
    password: Optional[str] = None

# ==========================
# ESQUEMAS PARA CLIENTES
# ==========================
class ClienteBase(BaseModel):
    nombre: str
    nombre_comercial: Optional[str] = None
    telefono: Optional[str] = None
    correo: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None

class ClienteCreate(ClienteBase):
    # 👇 LE DECIMOS A FASTAPI QUE AHORA EXIJA LA CÉDULA/RUC AL CREAR 👇
    id_cliente: str

class ClienteResponse(ClienteBase):
    id_cliente: str

    class Config:
        from_attributes = True

class ClienteUpdate(BaseModel):
    nombre: Optional[str] = None
    nombre_comercial: Optional[str] = None
    telefono: Optional[str] = None
    correo: Optional[str] = None
    direccion: Optional[str] = None
    ciudad: Optional[str] = None

# ==========================
# ESQUEMAS PARA PRODUCTOS
# ==========================
class ProductoBase(BaseModel):
    nombre: str
    es_estandar: Optional[bool] = True
    tiempo_fabricacion_horas: Decimal

class ProductoCreate(ProductoBase):
    pass

class ProductoResponse(ProductoBase):
    id_producto: int

    class Config:
        from_attributes = True

class ProductoUpdate(BaseModel):
    nombre: Optional[str] = None
    es_estandar: Optional[bool] = None
    tiempo_fabricacion_horas: Optional[Decimal] = None

class MaterialBase(BaseModel):
    nombre: str
    unidad_medida: Optional[str] = "Unidades"
    stock_actual: Decimal = Decimal('0.0')
    stock_minimo_alerta: Decimal = Decimal('0.0')
    precio_unitario: Decimal = Decimal('0.0') # 👈 Agregado

class MaterialCreate(MaterialBase):
    pass

class MaterialResponse(MaterialBase):
    id_material: int
    class Config:
        from_attributes = True
        

# ... (tus otros esquemas) ...

class MaterialUpdate(BaseModel):
    nombre: Optional[str] = None
    unidad_medida: Optional[str] = None
    stock_actual: Optional[Decimal] = None
    stock_minimo_alerta: Optional[Decimal] = None
    precio_unitario: Optional[Decimal] = None # 👈 Agregado

class EstructuraProductoCreate(BaseModel):
    id_producto: int
    id_material: int
    cantidad_necesaria: Decimal

class EstructuraProductoResponse(BaseModel):
    id_estructura: int  # La clave primaria de la receta
    id_producto: int
    id_material: int
    cantidad_necesaria: Decimal  # (Ojo: si en tu models.py se llama solo 'cantidad', pon 'cantidad: Decimal' aquí)

    class Config:
        from_attributes = True

# ==========================
# ESQUEMAS PARA PEDIDOS
# ==========================
class DetallePedidoCreate(BaseModel):
    id_producto: int
    cantidad: int

class PedidoCreate(BaseModel):
    id_cliente: str
    # 👇 LE DECIMOS A FASTAPI QUE ESPERE ESTE DATO DESDE ANGULAR 👇
    fecha_entrega: date 
    detalles: List[DetallePedidoCreate]

class PedidoResponse(BaseModel):
    id_pedido: int
    id_cliente: str
    estado: str
    class Config:
        from_attributes = True

class PedidoUpdate(BaseModel):
    id_cliente: Optional[str] = None
    fecha_entrega: Optional[date] = None
    detalles: Optional[List[DetallePedidoCreate]] = None

# ==========================================
# ESQUEMA PARA ACTUALIZAR ESTADOS
# ==========================================
class EstadoUpdate(BaseModel):
    estado: str  # Solo pedimos el texto del nuevo estado

# ... (Mantén lo anterior) ...

# ==========================
# ESQUEMAS PARA COMPRAS
# ==========================
class ProveedorBase(BaseModel):
    nombre: str

class ProveedorCreate(ProveedorBase):
    pass
# 1. Agrega este esquema de respuesta para el precio si no lo tenías
class PrecioProveedorResponse(BaseModel):
    id_precio: int
    id_material: int
    precio_unitario: Decimal
    descuento_porcentaje: Decimal

    class Config:
        from_attributes = True

# 2. Modifica tu ProveedorResponse para que incluya la lista de precios
class ProveedorResponse(ProveedorBase):
    id_proveedor: int
    precios: List[PrecioProveedorResponse] = [] # 👈 ESTA ES LA MAGIA

    class Config:
        from_attributes = True

class PrecioProveedorCreate(BaseModel):
    id_material: int
    id_proveedor: int
    precio_unitario: Decimal
    descuento_porcentaje: Optional[Decimal] = 0.0



class ProveedorUpdate(BaseModel):
    nombre: Optional[str] = None



class PrecioProveedorUpdate(BaseModel):
    precio_unitario: Optional[Decimal] = None
    descuento_porcentaje: Optional[Decimal] = None

class OrdenCompraResponse(BaseModel):
    id_orden_compra: int
    id_proveedor: int
    estado: str
    class Config:
        from_attributes = True

# ==========================================
# ESQUEMAS PARA ORDENES DE COMPRA
# ==========================================
class DetalleOrdenCompraResponse(BaseModel):
    id_detalle_compra: int
    id_orden_compra: int
    id_material: int
    cantidad: Decimal
    precio_unitario_acordado: Decimal
    
    class Config:
        from_attributes = True

class EstadoOrdenUpdate(BaseModel):
    estado: str

# ==========================================
# ESQUEMAS PARA EDITAR ORDEN DE COMPRA
# ==========================================
class DetalleEdicion(BaseModel):
    id_detalle_compra: int
    cantidad: Decimal

class OrdenEdicion(BaseModel):
    id_proveedor: int
    detalles: List[DetalleEdicion]

# ... (Mantén lo anterior) ...

# ==========================
# ESQUEMAS PARA ORDENES DE TRABAJO (PLANIFICACIÓN)
# ==========================
class OrdenTrabajoBase(BaseModel):
    id_detalle_pedido: int
    id_usuario: str
    fecha_inicio: date
    fecha_entrega_programada: date

class OrdenTrabajoCreate(OrdenTrabajoBase):
    pass

class OrdenTrabajoResponse(OrdenTrabajoBase):
    id_orden_trabajo: int
    estado: str
    fecha_entrega_real: Optional[date] = None

    class Config:
        from_attributes = True


class TareaReunion(BaseModel):
    accion: str
    responsable: str
    fecha_accion: Optional[str] = None # Como string para evitar dolores de cabeza con fechas vacías

class ReunionBase(BaseModel):
    motivo: str
    fecha: date
    hora: time
    participantes: str
    estado: Optional[str] = "PROGRAMADA"
    detalle: Optional[str] = None
    
    # 👇 Reemplazamos los 3 campos por esta lista 👇
    tareas: Optional[List[TareaReunion]] = []
class ReunionCreate(ReunionBase):
    pass

# 👇 schemas.py 👇

# (TareaReunion y ReunionBase se quedan igual)

class ReunionUpdate(BaseModel):
    motivo: Optional[str] = None
    fecha: Optional[date] = None
    hora: Optional[time] = None
    participantes: Optional[str] = None
    estado: Optional[str] = None
    # 👇 AGREGA ESTOS DOS CAMPOS 👇
    detalle: Optional[str] = None
    tareas: Optional[List[TareaReunion]] = [] 

# (ReunionResponse se queda igual)

class ReunionResponse(ReunionBase):
    id_reunion: int
    class Config:
        from_attributes = True

class MantenimientoBase(BaseModel):
    id_cliente: str
    id_producto: int
    fecha_mantenimiento: date
    descripcion: Optional[str] = None
    estado: Optional[str] = "Programado"

class MantenimientoCreate(MantenimientoBase):
    pass

class MantenimientoUpdate(BaseModel):
    id_cliente: Optional[str] = None
    id_producto: Optional[int] = None
    fecha_mantenimiento: Optional[date] = None
    descripcion: Optional[str] = None
    estado: Optional[str] = None

class MantenimientoResponse(MantenimientoBase):
    id_mantenimiento: int
    class Config:
        from_attributes = True

class EquipoDetalle(BaseModel):
    cantidad: int
    descripcion: str

class OrdenProduccionBase(BaseModel):
    numero_op: str
    numero_pedido: Optional[str] = None
    cliente_nombre: str
    cliente_cedula: Optional[str] = None
    cliente_direccion: Optional[str] = None
    cliente_telefono: Optional[str] = None
    cliente_email: Optional[str] = None
    recibido_por: Optional[str] = None
    fecha_pedido: Optional[date] = None
    fecha_inicio: Optional[date] = None
    fecha_entrega: Optional[date] = None
    descripcion_pedido: Optional[str] = None
    equipos: Optional[List[EquipoDetalle]] = []
    precio_total: Optional[float] = 0.0
    forma_pago: Optional[str] = None
    fecha_abono: Optional[date] = None
    valor_abono: Optional[float] = 0.0
    saldo: Optional[float] = 0.0

class OrdenProduccionCreate(OrdenProduccionBase):
    pass

class OrdenProduccionUpdate(BaseModel):
    # Todo opcional para poder actualizar campos sueltos
    numero_op: Optional[str] = None
    numero_pedido: Optional[str] = None
    cliente_nombre: Optional[str] = None
    cliente_cedula: Optional[str] = None
    cliente_direccion: Optional[str] = None
    cliente_telefono: Optional[str] = None
    cliente_email: Optional[str] = None
    recibido_por: Optional[str] = None
    fecha_pedido: Optional[date] = None
    fecha_inicio: Optional[date] = None
    fecha_entrega: Optional[date] = None
    descripcion_pedido: Optional[str] = None
    equipos: Optional[List[EquipoDetalle]] = None
    precio_total: Optional[float] = None
    forma_pago: Optional[str] = None
    fecha_abono: Optional[date] = None
    valor_abono: Optional[float] = None
    saldo: Optional[float] = None

class OrdenProduccionResponse(OrdenProduccionBase):
    id_orden: int
    class Config:
        from_attributes = True