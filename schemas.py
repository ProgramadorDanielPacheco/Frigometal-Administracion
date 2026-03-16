from pydantic import BaseModel
from typing import Optional
from decimal import Decimal
from datetime import date
from typing import List
from pydantic import BaseModel, EmailStr
from typing import Optional
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

# ==========================
# ESQUEMAS PARA CLIENTES
# ==========================
class ClienteBase(BaseModel):
    nombre: str
    telefono: Optional[str] = None
    correo: Optional[str] = None
    direccion: Optional[str] = None

class ClienteCreate(ClienteBase):
    # 👇 LE DECIMOS A FASTAPI QUE AHORA EXIJA LA CÉDULA/RUC AL CREAR 👇
    id_cliente: str

class ClienteResponse(ClienteBase):
    id_cliente: str

    class Config:
        from_attributes = True

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

class MaterialBase(BaseModel):
    nombre: str
    unidad_medida: Optional[str] = "Unidades"
    stock_actual: Decimal = 0.0
    stock_minimo_alerta: Decimal = 0.0

class MaterialCreate(MaterialBase):
    pass

class MaterialResponse(MaterialBase):
    id_material: int
    class Config:
        from_attributes = True

class EstructuraProductoCreate(BaseModel):
    id_producto: int
    id_material: int
    cantidad_requerida: Decimal

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

class ProveedorResponse(ProveedorBase):
    id_proveedor: int
    class Config:
        from_attributes = True

class PrecioProveedorCreate(BaseModel):
    id_material: int
    id_proveedor: int
    precio_unitario: Decimal
    descuento_porcentaje: Optional[Decimal] = 0.0

class OrdenCompraResponse(BaseModel):
    id_orden_compra: int
    id_proveedor: int
    estado: str
    class Config:
        from_attributes = True

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