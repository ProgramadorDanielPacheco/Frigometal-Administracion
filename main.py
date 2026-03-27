from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware # <-- NUEVO
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from fastapi import HTTPException, status
from datetime import date
from fastapi import UploadFile, File
import pandas as pd
import io
# 👇 Añade esta importación al principio de main.py si no la tienes 👇
from decimal import Decimal

import models
import schemas
from database import engine, get_db
from passlib.context import CryptContext

# Configuramos el encriptador de contraseñas
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

# 2. Esquema temporal solo para recibir los datos del login
class LoginRequest(BaseModel):
    correo: str
    password: str

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Frigometal ERP API", version="1.0")

# ==========================================
# CONFIGURACIÓN CORS (PERMITE AL FRONTEND CONECTARSE)
# ==========================================


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # El puerto por defecto de Angular
    allow_credentials=True,
    allow_methods=["*"], # Permite GET, POST, PUT, DELETE
    allow_headers=["*"],
)


def get_password_hash(password):
    return pwd_context.hash(password)

class PasswordUpdate(BaseModel):
    password_actual: str
    password_nueva: str

@app.put("/usuarios/{id_usuario}/password")
def cambiar_password(id_usuario: int, passwords: PasswordUpdate, db: Session = Depends(get_db)):
    usuario = db.query(models.Usuario).filter(models.Usuario.id_usuario == id_usuario).first()
    
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # Aquí debes usar tu función de encriptación (ej. verify_password)
    # Si guardas contraseñas en texto plano (NO RECOMENDADO), sería: if usuario.password != passwords.password_actual:
    if usuario.password != passwords.password_actual: 
        raise HTTPException(status_code=400, detail="La contraseña actual es incorrecta")

    # Guardamos la nueva (Idealmente debes encriptarla aquí antes de guardar)
    usuario.password = passwords.password_nueva 
    db.commit()
    
    return {"mensaje": "Contraseña actualizada exitosamente"}

@app.post("/login/", response_model=schemas.UsuarioResponse)
def iniciar_sesion(credenciales: LoginRequest, db: Session = Depends(get_db)):
    
    # Buscamos al usuario por su correo
    usuario = db.query(models.Usuario).filter(models.Usuario.correo == credenciales.correo).first()
    
    # Si no existe el correo, o si la contraseña no coincide (lanzamos el mismo error por seguridad para no dar pistas a los hackers)
    if not usuario or not verify_password(credenciales.password, usuario.hashed_password):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")
        
    # Verificamos si el dueño no lo ha despedido/desactivado
    if not usuario.activo:
        raise HTTPException(status_code=403, detail="Usuario inactivo. Contacta al administrador.")
        
    # Si todo está bien, devolvemos sus datos (sin la contraseña, gracias a tu UsuarioResponse)
    return usuario

@app.get("/")
def read_root():
    return {"mensaje": "¡Bienvenido a la API del ERP de Frigometal!"}

# ==========================================
# RUTAS PARA USUARIOS (TRABAJADORES/ADMIN)
# ==========================================

@app.post("/usuarios/", response_model=schemas.UsuarioResponse)
def crear_usuario(usuario: schemas.UsuarioCreate, db: Session = Depends(get_db)):
    
    # 1. Validar que la cédula sea correcta matemáticamente (Algoritmo Módulo 10)
    # (Asegúrate de tener importada tu función validar_identificacion_ec)
    if not validar_identificacion_ec(usuario.id_usuario):
        raise HTTPException(status_code=400, detail="La cédula ingresada no es válida")

    # 2. Verificar si la cédula ya está registrada (evita duplicados exactos)
    db_cedula = db.query(models.Usuario).filter(models.Usuario.id_usuario == usuario.id_usuario).first()
    if db_cedula:
        raise HTTPException(status_code=400, detail="Esta cédula ya está registrada en el sistema")

    # 3. Verificar si el correo ya existe
    db_correo = db.query(models.Usuario).filter(models.Usuario.correo == usuario.correo).first()
    if db_correo:
        raise HTTPException(status_code=400, detail="El correo ya está registrado")

    # 4. Encriptar la contraseña
    contra_encriptada = get_password_hash(usuario.password)
    
    # 5. Preparar el nuevo usuario asignando la cédula directamente
    nuevo_usuario = models.Usuario(
        id_usuario=usuario.id_usuario, # 👈 AHORA LE PASAMOS LA CÉDULA MANUALMENTE AQUÍ
        nombre=usuario.nombre,
        correo=usuario.correo,
        rol=usuario.rol,
        horas_maximas_semanales=usuario.horas_maximas_semanales,
        activo=usuario.activo,
        hashed_password=contra_encriptada # Guardamos la versión segura
    )
    
    db.add(nuevo_usuario)
    db.commit()
    db.refresh(nuevo_usuario)
    return nuevo_usuario

@app.get("/usuarios/", response_model=List[schemas.UsuarioResponse])
def obtener_usuarios(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    usuarios = db.query(models.Usuario).offset(skip).limit(limit).all()
    return usuarios

@app.put("/usuarios/{id_usuario}", response_model=schemas.UsuarioResponse)
def actualizar_usuario(id_usuario: str, usuario_update: schemas.UsuarioUpdate, db: Session = Depends(get_db)):
    # 1. Buscamos al trabajador en la base de datos por su cédula
    usuario_db = db.query(models.Usuario).filter(models.Usuario.id_usuario == id_usuario).first()
    
    if not usuario_db:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    # 2. Actualizamos solo los datos que Angular nos envió (ignoramos los nulos)
    if usuario_update.nombre is not None:
        usuario_db.nombre = usuario_update.nombre
        
    if usuario_update.correo is not None:
        usuario_db.correo = usuario_update.correo
        
    if usuario_update.rol is not None:
        usuario_db.rol = usuario_update.rol
        
    if usuario_update.horas_maximas_semanales is not None:
        usuario_db.horas_maximas_semanales = usuario_update.horas_maximas_semanales
        
    if usuario_update.activo is not None:
        usuario_db.activo = usuario_update.activo
        
    # 3. 👇 LA REGLA DE ORO DE LA CONTRASEÑA 👇
    # Si Angular nos mandó una contraseña nueva y no está vacía, la actualizamos
    if usuario_update.password and usuario_update.password.strip() != "":
        
        # ⚠️ IMPORTANTE: Aquí debes usar la función que usas para encriptar.
        # Por ejemplo, si usas passlib sería algo así:
        # pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        # usuario_db.hashed_password = pwd_context.hash(usuario_update.password)
        
        # Si tienes una función como get_password_hash, úsala así:
        usuario_db.hashed_password = get_password_hash(usuario_update.password)

    # 4. Guardamos los cambios
    db.commit()
    db.refresh(usuario_db)
    
    return usuario_db



# IMPORTACIÓN MASIVA DE USUARIOS (EXCEL)
# ==========================================
@app.post("/usuarios/importar/")
async def importar_usuarios_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="El archivo debe ser Excel (.xlsx)")

    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # Llenamos los espacios vacíos con valores por defecto seguros
        df = df.fillna({
            'cedula': '',
            'nombre': '', 
            'correo': '', 
            'rol': 'TRABAJADOR', 
            'horas_maximas_semanales': 40.0
        })

        usuarios_creados = 0
        errores = []

        for index, row in df.iterrows():
            # 1. Limpieza de datos
            cedula = str(row.get('cedula', '')).strip()
            if cedula.endswith(".0"): 
                cedula = cedula[:-2]
                
            nombre_user = str(row.get('nombre', '')).strip()
            correo_user = str(row.get('correo', '')).strip()
            rol_user = str(row.get('rol', 'TRABAJADOR')).strip().upper()
            
            # 2. Validar campos obligatorios
            if not cedula or not nombre_user or not correo_user:
                errores.append(f"Fila {index + 2}: Faltan datos (Cédula, Nombre o Correo).")
                continue

            # 3. Validar Cédula Ecuatoriana (Módulo 10)
            if not validar_identificacion_ec(cedula):
                errores.append(f"Fila {index + 2}: La cédula {cedula} es matemáticamente inválida.")
                continue

            try:
                horas_max = float(row.get('horas_maximas_semanales', 40.0))
            except ValueError:
                errores.append(f"Fila {index + 2}: Error numérico en las horas de '{nombre_user}'.")
                continue

            # 4. Evitar duplicados de Cédula
            existe_cedula = db.query(models.Usuario).filter(models.Usuario.id_usuario == cedula).first()
            if existe_cedula:
                errores.append(f"Fila {index + 2}: La cédula {cedula} ya está registrada.")
                continue

            # 5. Evitar duplicados de Correo
            existe_correo = db.query(models.Usuario).filter(models.Usuario.correo == correo_user).first()
            if existe_correo:
                errores.append(f"Fila {index + 2}: El correo {correo_user} ya está en uso.")
                continue

            # 6. MAGIA: Usamos la cédula como contraseña temporal y la encriptamos
            contra_encriptada = get_password_hash(cedula)

            # 7. Crear el usuario
            nuevo_usuario = models.Usuario(
                id_usuario=cedula, # Asignación manual del ID (Cédula)
                nombre=nombre_user,
                correo=correo_user,
                rol=rol_user,
                horas_maximas_semanales=horas_max,
                activo=True,
                hashed_password=contra_encriptada # Contraseña segura
            )
            db.add(nuevo_usuario)
            usuarios_creados += 1

        # Confirmamos la transacción completa
        db.commit()
        
        return {
            "mensaje": f"Personal importado exitosamente: {usuarios_creados} usuarios nuevos.",
            "errores": errores
        }

    except Exception as e:
        db.rollback() 
        raise HTTPException(status_code=500, detail=f"Error leyendo el Excel: {str(e)}")
# ==========================================
# RUTAS PARA CLIENTES
# ==========================================

def validar_identificacion_ec(identificacion: str) -> bool:
    if not identificacion or not identificacion.isdigit() or len(identificacion) not in [10, 13]:
        return False
    
    provincia = int(identificacion[0:2])
    # Provincias de Ecuador van del 01 al 24 (y 30 para ecuatorianos en el exterior)
    if provincia < 1 or (provincia > 24 and provincia != 30):
        return False
        
    tercer_digito = int(identificacion[2])

    # 1. Validación para Personas Naturales (Cédula o RUC que termina en 001)
    if tercer_digito < 6:
        if len(identificacion) == 13 and identificacion[10:13] != "001":
            return False
        
        # Algoritmo Módulo 10 del Registro Civil
        suma = 0
        for i in range(9):
            valor = int(identificacion[i])
            if i % 2 == 0:  # Posiciones impares (índices pares) se multiplican por 2
                valor *= 2
                if valor > 9:
                    valor -= 9
            suma += valor
            
        digito_verificador = int(identificacion[9])
        calculado = (10 - (suma % 10)) % 10
        return calculado == digito_verificador

    # 2. Validación estructural para Sociedades Privadas (Tercer dígito = 9, termina en 001)
    elif tercer_digito == 9:
        if len(identificacion) != 13 or identificacion[10:13] != "001":
            return False
        return True # (Aquí se podría agregar el Módulo 11 si se desea más precisión)

    # 3. Validación estructural para Entidades Públicas (Tercer dígito = 6, termina en 0001)
    elif tercer_digito == 6:
        if len(identificacion) != 13 or identificacion[9:13] != "0001":
            return False
        return True

    return False

# ==========================================
# ENDPOINT ACTUALIZADO DE CLIENTES
# ==========================================
@app.post("/clientes/", response_model=schemas.ClienteResponse)
def crear_cliente(cliente: schemas.ClienteCreate, db: Session = Depends(get_db)):
    
    # 1. Llamamos a nuestra validación antes de tocar la base de datos
    if not validar_identificacion_ec(cliente.id_cliente):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="La Cédula o RUC ingresado no es válido en Ecuador."
        )
    
    # 2. Verificamos que no exista ya en la base de datos
    cliente_existente = db.query(models.Cliente).filter(models.Cliente.id_cliente == cliente.id_cliente).first()
    if cliente_existente:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Este cliente ya está registrado en el sistema."
        )

    # 3. Guardamos si todo está perfecto
    nuevo_cliente = models.Cliente(**cliente.model_dump())
    db.add(nuevo_cliente)
    db.commit()
    db.refresh(nuevo_cliente)
    return nuevo_cliente

@app.get("/clientes/", response_model=List[schemas.ClienteResponse])
def obtener_clientes(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    clientes = db.query(models.Cliente).offset(skip).limit(limit).all()
    return clientes

@app.put("/clientes/{id_cliente}", response_model=schemas.ClienteResponse)
def actualizar_cliente(id_cliente: str, cliente_update: schemas.ClienteUpdate, db: Session = Depends(get_db)):
    cliente_db = db.query(models.Cliente).filter(models.Cliente.id_cliente == id_cliente).first()
    
    if not cliente_db:
        raise HTTPException(status_code=404, detail="Cliente no encontrado")

    if cliente_update.nombre is not None:
        cliente_db.nombre = cliente_update.nombre
    if cliente_update.nombre_comercial is not None:
        cliente_db.nombre_comercial = cliente_update.nombre_comercial
    if cliente_update.telefono is not None:
        cliente_db.telefono = cliente_update.telefono
    if cliente_update.correo is not None:
        cliente_db.correo = cliente_update.correo
    if cliente_update.direccion is not None:
        cliente_db.direccion = cliente_update.direccion
    if cliente_update.ciudad is not None:
        cliente_db.ciudad = cliente_update.ciudad

    db.commit()
    db.refresh(cliente_db)
    return cliente_db

# ==========================================
# IMPORTACIÓN MASIVA DE CLIENTES (EXCEL)
# ==========================================
@app.post("/clientes/importar/")
async def importar_clientes_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    # 1. Verificar que sea un Excel
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="El archivo debe ser un formato Excel (.xlsx)")

    try:
        # 2. Leer el archivo directamente desde la memoria
        contents = await file.read()
        
        # 👇 ARREGLO CRÍTICO: dtype=str fuerza a que NO se borren los ceros a la izquierda de las cédulas
        df = pd.read_excel(io.BytesIO(contents), dtype=str)
        
        # Llenar los espacios vacíos con texto en blanco para evitar errores 'NaN'
        df = df.fillna("")

        clientes_agregados = 0
        errores = []

        # 3. Recorrer fila por fila el Excel
        for index, row in df.iterrows():
            # Buscamos las columnas por su nombre exacto en el encabezado del Excel
            cedula = str(row.get('cedula_cliente', '')).strip()
            
            # (Truco por si acaso Excel forzó algún ".0" al final, aunque dtype=str suele evitarlo)
            if cedula.endswith(".0"): 
                cedula = cedula[:-2]
            
            nombre = str(row.get('nombre', '')).strip()
            
            # 👇 AÑADIMOS LOS NUEVOS CAMPOS DE TU MODELO 👇
            nombre_comercial = str(row.get('nombre_comercial', '')).strip()
            ciudad = str(row.get('ciudad', '')).strip()
            
            telefono = str(row.get('telefono', '')).strip()
            correo = str(row.get('correo', '')).strip()
            direccion = str(row.get('direccion', '')).strip()

            # Validar que no falten los datos obligatorios
            if not cedula or not nombre:
                errores.append(f"Fila {index + 2}: Cédula o Nombre vacíos.")
                continue

            # Usamos el validador estricto que creaste antes
            if not validar_identificacion_ec(cedula):
                errores.append(f"Fila {index + 2}: Cédula/RUC inválido ({cedula}).")
                continue

            # Verificamos si ya existe para no duplicar
            existe = db.query(models.Cliente).filter(models.Cliente.id_cliente == cedula).first()
            if existe:
                errores.append(f"Fila {index + 2}: El cliente {cedula} ya existe en el sistema.")
                continue

            # Si pasa todas las pruebas, preparamos al cliente para guardarlo
            nuevo_cliente = models.Cliente(
                id_cliente=cedula,
                nombre=nombre,
                nombre_comercial=nombre_comercial, # 👈 INYECTADO AQUÍ
                telefono=telefono,
                correo=correo,
                direccion=direccion,
                ciudad=ciudad # 👈 INYECTADO AQUÍ
            )
            db.add(nuevo_cliente)
            clientes_agregados += 1

        # 4. Guardamos todos los clientes exitosos de golpe
        db.commit()
        
        return {
            "mensaje": f"Importación exitosa: {clientes_agregados} clientes nuevos.",
            "errores": errores # Devolvemos un reporte de los que fallaron para que el dueño sepa
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error leyendo el Excel: {str(e)}")

# ==========================================
# RUTAS PARA PRODUCTOS
# ==========================================

@app.post("/productos/", response_model=schemas.ProductoResponse)
def crear_producto(producto: schemas.ProductoCreate, db: Session = Depends(get_db)):
    nuevo_producto = models.Producto(**producto.model_dump())
    db.add(nuevo_producto)
    db.commit()
    db.refresh(nuevo_producto)
    return nuevo_producto

@app.get("/productos/", response_model=List[schemas.ProductoResponse])
def obtener_productos(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    productos = db.query(models.Producto).offset(skip).limit(limit).all()
    return productos
# Ejemplo para Materiales

# ==========================================
# IMPORTACIÓN MASIVA: PRODUCTOS + ESTRUCTURA (EXCEL)
# ==========================================
@app.post("/productos/importar-catalogo/")
async def importar_productos_estructura(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="El archivo debe ser Excel (.xlsx)")

    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        
        # Limpiamos los vacíos
        df = df.fillna({
            'nombre_producto': '',
            'tiempo_fabricacion': 0.0,
            'id_material': 0,
            'cantidad_material': 0.0
        })

        productos_creados = 0
        materiales_enlazados = 0
        errores = []
        
        # Memoria temporal para agrupar los materiales de un mismo producto
        productos_cache = {}

        for index, row in df.iterrows():
            nombre_prod = str(row.get('nombre_producto', '')).strip()
            
            if not nombre_prod:
                continue # Saltamos filas en blanco

            try:
                tiempo_fab = float(row.get('tiempo_fabricacion', 0.0))
                id_mat = int(row.get('id_material', 0))
                cantidad_mat = float(row.get('cantidad_material', 0.0))
            except ValueError:
                errores.append(f"Fila {index + 2}: Error numérico en tiempo, ID de material o cantidad.")
                continue

            # ==========================================
            # PASO 1: CREAR O IDENTIFICAR EL PRODUCTO
            # ==========================================
            if nombre_prod not in productos_cache:
                producto = db.query(models.Producto).filter(models.Producto.nombre == nombre_prod).first()
                
                if not producto:
                    # Si el producto no existe en la BD, lo creamos
                    producto = models.Producto(
                        nombre=nombre_prod,
                        tiempo_fabricacion_horas=tiempo_fab
                    )
                    db.add(producto)
                    db.flush() # Guardamos temporalmente para que Python le genere el ID
                    productos_creados += 1
                    
                # Guardamos el producto en caché para esta sesión
                productos_cache[nombre_prod] = producto

            producto_actual = productos_cache[nombre_prod]

            # ==========================================
            # PASO 2: AGREGAR A LA ESTRUCTURA DEL PRODUCTO
            # ==========================================
            if id_mat > 0 and cantidad_mat > 0:
                # Validar que el material exista en el inventario
                material_existe = db.query(models.Material).filter(models.Material.id_material == id_mat).first()
                
                if not material_existe:
                    errores.append(f"Fila {index + 2}: El material ID {id_mat} no existe en el inventario.")
                    continue
                
                # Revisamos si ya existe este material en la estructura de este producto
                ingrediente_existente = db.query(models.EstructuraProducto).filter(
                    models.EstructuraProducto.id_producto == producto_actual.id_producto,
                    models.EstructuraProducto.id_material == id_mat
                ).first()

                if not ingrediente_existente:
                    # 👇 USAMOS TU MODELO EXACTO AQUÍ 👇
                    nuevo_ingrediente = models.EstructuraProducto(
                        id_producto=producto_actual.id_producto,
                        id_material=id_mat,
                        cantidad_requerida=cantidad_mat # <-- Tu columna exacta
                    )
                    db.add(nuevo_ingrediente)
                    materiales_enlazados += 1

        # Confirmamos todo el lote
        db.commit()
        
        return {
            "mensaje": f"Catálogo actualizado: {productos_creados} productos nuevos y {materiales_enlazados} materiales añadidos a sus estructuras.",
            "errores": errores
        }

    except Exception as e:
        db.rollback() # Cancelamos si el archivo explota
        raise HTTPException(status_code=500, detail=f"Error procesando el Excel: {str(e)}")

@app.put("/productos/{id_producto}", response_model=schemas.ProductoResponse)
def actualizar_producto(id_producto: int, producto_actualizado: schemas.ProductoUpdate, db: Session = Depends(get_db)):
    # 1. Buscamos el producto
    producto_db = db.query(models.Producto).filter(models.Producto.id_producto == id_producto).first()
    
    if not producto_db:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    # 👇 2. EL CAMBIO MÁGICO ESTÁ AQUÍ (exclude_none=True)
    datos_nuevos = producto_actualizado.model_dump(exclude_none=True)
    
    # Opcional: Esto imprimirá en tu consola negra de Python lo que está a punto de guardar
    print("ESTO VOY A GUARDAR:", datos_nuevos) 
    
    # 3. Guardamos
    for clave, valor in datos_nuevos.items():
        setattr(producto_db, clave, valor)
        
    db.commit()
    db.refresh(producto_db)
    
    return producto_db

@app.post("/materiales/", response_model=schemas.MaterialResponse)
def crear_material(material: schemas.MaterialCreate, db: Session = Depends(get_db)):
    nuevo_material = models.Material(**material.model_dump())
    db.add(nuevo_material)
    db.commit()
    db.refresh(nuevo_material)
    return nuevo_material


# ==========================================
# IMPORTACIÓN MASIVA DE MATERIALES (EXCEL)
# ==========================================
@app.post("/materiales/importar/")
async def importar_materiales_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="El archivo debe ser Excel (.xlsx)")

    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        df = df.fillna({
            'nombre': '', 
            'unidad_medida': 'Unidades', 
            'stock_actual': 0, 
            'stock_minimo_alerta': 0,
            'precio_unitario': 0 # 👈 Agregado
        })

        materiales_agregados = 0
        errores = []

        for index, row in df.iterrows():
            # 1. Leer textos
            nombre_mat = str(row.get('nombre', '')).strip()
            unidad = str(row.get('unidad_medida', 'Unidades')).strip()
            
            if not nombre_mat:
                errores.append(f"Fila {index + 2}: El nombre del material está vacío.")
                continue

            # 2. Leer números (con protección por si en el Excel escribieron letras por error)
            try:
                stock = float(row.get('stock_actual', 0))
                stock_minimo = float(row.get('stock_minimo_alerta', 0))
            except ValueError:
                errores.append(f"Fila {index + 2}: Error en los números de stock del material '{nombre_mat}'.")
                continue

            # 3. Evitar duplicados (Buscamos si ya existe un material con ese nombre exacto)
            # ⚠️ Asegúrate de que 'models.Material' coincida con tu código real
            existe = db.query(models.Material).filter(models.Material.nombre == nombre_mat).first()
            if existe:
                # Si ya existe, podríamos sumarle el stock, pero por seguridad mejor avisamos
                errores.append(f"Fila {index + 2}: El material '{nombre_mat}' ya existe en el inventario.")
                continue

            precio = float(row.get('precio_unitario', 0))
            # 4. Guardar en la base de datos
            nuevo_material = models.Material(
                nombre=nombre_mat,
                unidad_medida=unidad,
                stock_actual=stock,
                stock_minimo_alerta=stock_minimo,
                precio_unitario=precio # 👈 Guardar precio
            )
            db.add(nuevo_material)
            materiales_agregados += 1

        db.commit()
        
        return {
            "mensaje": f"Inventario actualizado: {materiales_agregados} materiales nuevos importados.",
            "errores": errores
        }

    except Exception as e:
        db.rollback() 
        raise HTTPException(status_code=500, detail=f"Error leyendo el Excel: {str(e)}")
    
# Ejemplo para Materiales

@app.put("/materiales/{id_material}", response_model=schemas.MaterialResponse)
def actualizar_material(id_material: int, material_actualizado: schemas.MaterialUpdate, db: Session = Depends(get_db)):
    # 1. Buscamos si el material existe
    material_db = db.query(models.Material).filter(models.Material.id_material == id_material).first()
    
    if not material_db:
        raise HTTPException(status_code=404, detail="Material no encontrado")
    
    # 2. Actualizamos solo los campos que el usuario envió
    datos_nuevos = material_actualizado.model_dump(exclude_unset=True)
    
    for clave, valor in datos_nuevos.items():
        setattr(material_db, clave, valor)
        
    # 3. Guardamos los cambios
    db.commit()
    db.refresh(material_db) # Recarga los datos actualizados
    
    return material_db

@app.post("/estructura-producto/", response_model=schemas.EstructuraProductoResponse)
def agregar_material_a_producto(estructura: schemas.EstructuraProductoCreate, db: Session = Depends(get_db)):
    
    # 1. TRADUCCIÓN DE IDA: De Angular (necesaria) a la Base de Datos (requerida)
    nueva_estructura = models.EstructuraProducto(
        id_producto=estructura.id_producto,
        id_material=estructura.id_material,
        cantidad_requerida=estructura.cantidad_necesaria # 👈 ¡AQUÍ CONECTAMOS LOS CABLES!
    )
    
    db.add(nueva_estructura)
    db.commit()
    db.refresh(nueva_estructura)
    
    # 2. TRADUCCIÓN DE VUELTA: De la Base de Datos a Angular
    # Devolvemos un diccionario "disfrazado" para que Angular reciba el nombre que le gusta
    return {
        "id_estructura": nueva_estructura.id_estructura,
        "id_producto": nueva_estructura.id_producto,
        "id_material": nueva_estructura.id_material,
        "cantidad_necesaria": nueva_estructura.cantidad_requerida
    }
@app.get("/estructura-producto/{id_producto}", response_model=List[schemas.EstructuraProductoResponse])
def obtener_receta_producto(id_producto: int, db: Session = Depends(get_db)):
    # 1. Buscamos la receta
    receta = db.query(models.EstructuraProducto).filter(models.EstructuraProducto.id_producto == id_producto).all()
    
    # 2. MAPEAMOS los datos para que 'cantidad_requerida' pase a ser 'cantidad_necesaria'
    # Esto asegura que Angular reciba el nombre exacto que está esperando.
    receta_mapeada = []
    for item in receta:
        receta_mapeada.append({
            "id_estructura": item.id_estructura,
            "id_producto": item.id_producto,
            "id_material": item.id_material,
            "cantidad_necesaria": item.cantidad_requerida # 👈 Aquí ocurre la magia
        })
        
    return receta_mapeada
@app.delete("/estructura-producto/{id_estructura}")
def eliminar_material_receta(id_estructura: int, db: Session = Depends(get_db)):
    # Buscamos el registro específico que queremos borrar
    item = db.query(models.EstructuraProducto).filter(models.EstructuraProducto.id_estructura == id_estructura).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="El material no existe en esta receta")
        
    db.delete(item)
    db.commit()
    return {"mensaje": "Material eliminado de la receta con éxito."}

# ==========================================
# RUTAS PARA PEDIDOS Y DESCUENTO DE STOCK (LA MAGIA)
# ==========================================

def sincronizar_inventario_pedido(id_pedido: int, db: Session):
    pedido = db.query(models.Pedido).filter(models.Pedido.id_pedido == id_pedido).first()
    
    # 1. SEGURIDAD: Si no existe o ya se entregó, NO HACEMOS NADA.
    if not pedido or "ENTREGADO" in pedido.estado:
        return 

    # 2. Calculamos qué necesita la receta HOY
    necesidad_actual = {}
    detalles_del_pedido = db.query(models.DetallePedido).filter(models.DetallePedido.id_pedido == id_pedido).all()
    
    for detalle in detalles_del_pedido:
        receta = db.query(models.EstructuraProducto).filter(models.EstructuraProducto.id_producto == detalle.id_producto).all()
        for ingrediente in receta:
            mat_id = str(ingrediente.id_material)
            cantidad_total = float(ingrediente.cantidad_requerida) * float(detalle.cantidad)
            necesidad_actual[mat_id] = necesidad_actual.get(mat_id, 0.0) + cantidad_total

    # 3. Leemos la "Memoria"
    memoria = dict(pedido.materiales_descontados) if pedido.materiales_descontados else {}
    cambios_realizados = False

    # 4. Comparamos Receta de HOY vs Memoria
    for mat_id, cant_necesaria in necesidad_actual.items():
        cant_ya_descontada = float(memoria.get(mat_id, 0.0))
        diferencia_a_descontar = cant_necesaria - cant_ya_descontada
        
        # Solo descontamos si la diferencia es POSITIVA
        if diferencia_a_descontar > 0:
            material_bodega = db.query(models.Material).filter(models.Material.id_material == int(mat_id)).first()
            
            if material_bodega:
                # 👇 LA MAGIA ANTI-ERRORES AQUÍ 👇
                # Convertimos el float a un string, y luego a un Decimal estricto para PostgreSQL
                descuento_seguro = Decimal(str(diferencia_a_descontar))
                
                material_bodega.stock_actual -= descuento_seguro
                memoria[mat_id] = cant_necesaria 
                cambios_realizados = True
                
                print(f"Sincronizando: Descontando {descuento_seguro} de {material_bodega.nombre}. Nuevo stock: {material_bodega.stock_actual}")

                # ==========================================
                # LÓGICA DE COMPRA INTELIGENTE
                # ==========================================
                if material_bodega.stock_actual <= material_bodega.stock_minimo_alerta:
                    orden_pendiente = db.query(models.DetalleOrdenCompra).join(models.OrdenCompra).filter(
                        models.DetalleOrdenCompra.id_material == material_bodega.id_material,
                        models.OrdenCompra.estado == 'BORRADOR'
                    ).first()
                    
                    if not orden_pendiente:
                        print(f"⚠️ Alerta: {material_bodega.nombre} bajo stock. Generando Orden de Compra...")
                        proveedor_info = db.query(models.PrecioProveedor).filter(models.PrecioProveedor.id_material == material_bodega.id_material).first()
                        
                        id_prov_sugerido = proveedor_info.id_proveedor if proveedor_info else 1
                        precio_sugerido = proveedor_info.precio_unitario if proveedor_info else 0.0
                        
                        nueva_orden = models.OrdenCompra(id_proveedor=id_prov_sugerido, estado='BORRADOR')
                        db.add(nueva_orden)
                        db.flush()
                        
                        cantidad_a_comprar = (material_bodega.stock_minimo_alerta - material_bodega.stock_actual) + 10
                        nuevo_detalle = models.DetalleOrdenCompra(
                            id_orden_compra=nueva_orden.id_orden_compra,
                            id_material=material_bodega.id_material,
                            cantidad=cantidad_a_comprar,
                            precio_unitario_acordado=precio_sugerido
                        )
                        db.add(nuevo_detalle)

    # 5. Si hubo cambios, guardamos
    if cambios_realizados:
        pedido.materiales_descontados = memoria
        db.commit()

@app.post("/pedidos/", response_model=schemas.PedidoResponse)
def crear_pedido(pedido: schemas.PedidoCreate, db: Session = Depends(get_db)):
    # 1. Creamos la cabecera del pedido (Estado por defecto: PENDIENTE)
    nuevo_pedido = models.Pedido(
        id_cliente=pedido.id_cliente, 
        fecha_entrega=pedido.fecha_entrega,
        estado="PENDIENTE" 
    )
    db.add(nuevo_pedido)
    db.flush() # Para obtener el ID del pedido

    # 2. Registramos los productos solicitados
    for detalle in pedido.detalles:
        nuevo_detalle = models.DetallePedido(
            id_pedido=nuevo_pedido.id_pedido,
            id_producto=detalle.id_producto,
            cantidad=detalle.cantidad
        )
        db.add(nuevo_detalle)

    db.commit()
    db.refresh(nuevo_pedido)
    return nuevo_pedido

# ==========================================
# OBTENER EL HISTORIAL DE PEDIDOS (GET)
# ==========================================
@app.get("/pedidos/")
def obtener_pedidos(db: Session = Depends(get_db)):
    # 1. Traemos todos los pedidos básicos de la tabla principal
    pedidos = db.query(models.Pedido).all()
    
    resultado = []
    
    # 2. Recorremos cada pedido uno por uno
    for p in pedidos:
        # Buscamos los productos específicos de ESTE pedido en la tabla de detalles
        detalles = db.query(models.DetallePedido).filter(models.DetallePedido.id_pedido == p.id_pedido).all()
        
        # 3. Armamos un "paquete" con los datos del pedido + sus detalles
        pedido_empaquetado = {
            "id_pedido": p.id_pedido,
            "id_cliente": p.id_cliente,
            "fecha_entrega": p.fecha_entrega,
            # Usamos getattr por si tu tabla Pedido no tiene la columna 'estado'
            "estado": getattr(p, "estado", "Pendiente"), 
            "detalles": detalles # ¡Aquí incrustamos los productos y cantidades!
        }
        
        resultado.append(pedido_empaquetado)
        
    return resultado

class EstadoUpdate(BaseModel):
    estado: str

@app.put("/pedidos/{id_pedido}")
def actualizar_pedido(id_pedido: int, pedido_actualizado: schemas.PedidoUpdate, db: Session = Depends(get_db)):
    pedido_db = db.query(models.Pedido).filter(models.Pedido.id_pedido == id_pedido).first()
    
    if not pedido_db:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")

    # 1. Actualizar datos principales (Cliente y Fecha)
    if pedido_actualizado.id_cliente is not None:
        pedido_db.id_cliente = pedido_actualizado.id_cliente
    if pedido_actualizado.fecha_entrega is not None:
        pedido_db.fecha_entrega = pedido_actualizado.fecha_entrega

    # 2. Actualizar el producto y la cantidad (Detalles)
    if pedido_actualizado.detalles is not None:
        # Borramos el detalle viejo de la base de datos
        db.query(models.DetallePedido).filter(models.DetallePedido.id_pedido == id_pedido).delete()
        # Insertamos el nuevo
        for det in pedido_actualizado.detalles:
            nuevo_detalle = models.DetallePedido(
                id_pedido=id_pedido,
                id_producto=det.id_producto,
                cantidad=det.cantidad
            )
            db.add(nuevo_detalle)

    db.commit()
    return {"mensaje": "Pedido actualizado correctamente"}




# ==========================================
# ACTUALIZAR ESTADO DEL PEDIDO (PATCH)
# ==========================================
# ==========================================
# ACTUALIZAR ESTADO DEL PEDIDO (PATCH)
# ==========================================
# ==========================================
# ACTUALIZAR ESTADO DEL PEDIDO (PATCH)
# ==========================================
@app.patch("/pedidos/{id_pedido}/estado")
def actualizar_estado_pedido(id_pedido: int, estado_update: schemas.EstadoUpdate, db: Session = Depends(get_db)):
    pedido = db.query(models.Pedido).filter(models.Pedido.id_pedido == id_pedido).first()
    
    if not pedido:
        raise HTTPException(status_code=404, detail="Pedido no encontrado")
        
    # 1. Guardamos el nuevo estado (ej: EN PRODUCCIÓN o ENTREGADO)
    pedido.estado = estado_update.estado
    db.commit()
    
    # 2. 👇 LLAMAMOS A LA FUNCIÓN INTELIGENTE DE INVENTARIO 👇
    # Sincroniza el inventario solo si está en producción o si lo acaban de terminar
    if estado_update.estado in ['EN PRODUCCIÓN', 'ENTREGADO', 'ENTREGADO CON ATRASO']:
        sincronizar_inventario_pedido(id_pedido, db)
        
    # 3. 👇 NUEVA MAGIA: AUTOCREACIÓN DE ÓRDENES DE PLANTA 👇
    if estado_update.estado == 'EN PRODUCCIÓN':
        # Verificamos si ya existen órdenes de planta para este pedido (evita duplicados si le dan al botón "Sincronizar" en Angular)
        ops_existentes = db.query(models.OrdenPlanta).filter(models.OrdenPlanta.id_pedido == id_pedido).count()
        
        if ops_existentes == 0:
            detalles_del_pedido = db.query(models.DetallePedido).filter(models.DetallePedido.id_pedido == id_pedido).all()
            
            # Obtenemos el nombre del cliente para copiarlo a la OP
            cliente = db.query(models.Cliente).filter(models.Cliente.id_cliente == pedido.id_cliente).first()
            cliente_nombre = cliente.nombre if cliente else "Cliente Desconocido"
            
            for detalle in detalles_del_pedido:
                # Generamos un número temporal fácil de identificar. Ej: OP-P15-PROD3
                numero_op_generado = f"OP-P{id_pedido}-PROD{detalle.id_producto}"
                
                nueva_op = models.OrdenPlanta(
                    numero_op=numero_op_generado,
                    id_pedido=id_pedido,
                    id_producto=detalle.id_producto,
                    cantidad=detalle.cantidad,
                    cliente_nombre=cliente_nombre,
                    fecha_entrega_prevista=pedido.fecha_entrega,
                    estado='EN COLA'
                )
                db.add(nueva_op)
                
            db.commit() # Guardamos todas las nuevas OPs generadas en la base de datos
    
    db.refresh(pedido)
    return {"mensaje": f"Estado actualizado a {estado_update.estado}"}
# ==========================================
# IMPORTACIÓN MASIVA DE PROVEEDORES (EXCEL)
# ==========================================
# ==========================================
# IMPORTACIÓN MASIVA: PROVEEDORES + PRECIOS (EXCEL)
# ==========================================
@app.post("/proveedores/importar-catalogo/")
async def importar_catalogo_proveedores(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="El archivo debe ser Excel (.xlsx)")

    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        # Llenamos los textos vacíos con "" y los números vacíos con 0
        df = df.fillna({
            'nombre_proveedor': '', 
            'id_material': 0, 
            'precio_unitario': 0.0, 
            'descuento': 0.0
        })

        registros_exitosos = 0
        errores = []

        for index, row in df.iterrows():
            nombre_prov = str(row.get('nombre_proveedor', '')).strip()
            
            # Evitamos errores si en el Excel dejaron una fila en blanco
            if not nombre_prov:
                continue 
                
            # Extraemos los números de forma segura
            try:
                id_mat = int(row.get('id_material', 0))
                precio = float(row.get('precio_unitario', 0.0))
                desc = float(row.get('descuento', 0.0))
            except ValueError:
                errores.append(f"Fila {index + 2}: Error en los números de precio, descuento o ID.")
                continue

            # PASO 1: BUSCAR O CREAR AL PROVEEDOR
            proveedor = db.query(models.Proveedor).filter(models.Proveedor.nombre == nombre_prov).first()
            if not proveedor:
                proveedor = models.Proveedor(nombre=nombre_prov)
                db.add(proveedor)
                db.flush() # Guardamos temporalmente para que Python le genere un ID nuevo

            # PASO 2: VERIFICAR QUE EL MATERIAL EXISTA (Si nos pasaron un ID de material)
            if id_mat > 0:
                # ⚠️ Asegúrate de que 'models.Material' y 'id_material' coincidan con tu código real
                material_existe = db.query(models.Material).filter(models.Material.id_material == id_mat).first()
                
                if not material_existe:
                    errores.append(f"Fila {index + 2}: El material con ID {id_mat} no existe en el inventario.")
                    continue

                # PASO 3: ASIGNAR EL PRECIO EN LA TABLA 'precios_proveedor'
                # Primero revisamos si ya le habíamos asignado un precio antes a ese material con este proveedor
                precio_existente = db.query(models.PrecioProveedor).filter(
                    models.PrecioProveedor.id_proveedor == proveedor.id_proveedor,
                    models.PrecioProveedor.id_material == id_mat
                ).first()

                if precio_existente:
                    # Si ya existía, le actualizamos el precio y el descuento
                    precio_existente.precio_unitario = precio
                    precio_existente.descuento_porcentaje = desc
                else:
                    # Si es nuevo, creamos el enlace en Compras Inteligentes
                    nuevo_precio = models.PrecioProveedor(
                        id_proveedor=proveedor.id_proveedor,
                        id_material=id_mat,
                        precio_unitario=precio,
                        descuento_porcentaje=desc
                    )
                    db.add(nuevo_precio)
            
            registros_exitosos += 1

        # Guardamos todo el lote de una sola vez
        db.commit()
        
        return {
            "mensaje": f"Catálogo importado: {registros_exitosos} precios/proveedores procesados.",
            "errores": errores
        }

    except Exception as e:
        db.rollback() # Si algo explota, cancelamos todo para no dañar la base
        raise HTTPException(status_code=500, detail=f"Error leyendo el Excel: {str(e)}")

# ==========================================
# IMPORTACIÓN MASIVA DE PEDIDOS Y DETALLES (EXCEL)
# ==========================================
@app.post("/pedidos/importar/")
async def importar_pedidos_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith(('.xls', '.xlsx')):
        raise HTTPException(status_code=400, detail="El archivo debe ser Excel (.xlsx)")

    try:
        contents = await file.read()
        df = pd.read_excel(io.BytesIO(contents))
        df = df.fillna("")

        # Diccionario para agrupar productos en un solo pedido si coinciden en cliente y fecha
        # Llave: (cedula, fecha) -> Valor: Objeto del Pedido recién creado
        pedidos_creados = {} 
        
        contadores = {"pedidos": 0, "productos": 0}
        errores = []

        for index, row in df.iterrows():
            # 1. Limpieza de datos (Evitar el .0 en la cédula si Excel lo leyó como número)
            cedula = str(row.get('cedula_cliente', '')).strip()
            if cedula.endswith(".0"): 
                cedula = cedula[:-2]
                
            # Extraemos los primeros 10 caracteres de la fecha (YYYY-MM-DD)
            fecha_str = str(row.get('fecha_entrega', ''))[:10].strip()
            
            try:
                id_prod = int(row.get('id_producto', 0))
                cantidad = int(row.get('cantidad', 0))
            except ValueError:
                errores.append(f"Fila {index + 2}: El ID del producto o la cantidad deben ser números.")
                continue

            # 2. Validaciones básicas
            if not cedula or not fecha_str or id_prod <= 0 or cantidad <= 0:
                errores.append(f"Fila {index + 2}: Faltan datos obligatorios (Cédula, Fecha, ID o Cantidad).")
                continue

            # 3. Validar que el cliente exista en la base de datos
            cliente = db.query(models.Cliente).filter(models.Cliente.id_cliente == cedula).first()
            if not cliente:
                errores.append(f"Fila {index + 2}: El cliente con cédula {cedula} no está registrado.")
                continue

            # 4. Validar que el producto exista en el catálogo
            producto = db.query(models.Producto).filter(models.Producto.id_producto == id_prod).first()
            if not producto:
                errores.append(f"Fila {index + 2}: El producto con ID {id_prod} no existe en el catálogo.")
                continue

            # ==========================================
            # MAGIA RELACIONAL: AGRUPAMIENTO
            # ==========================================
            clave_agrupacion = (cedula, fecha_str)

            # Si es la primera vez que vemos a este cliente con esta fecha, creamos el Pedido Padre
            if clave_agrupacion not in pedidos_creados:
                nuevo_pedido = models.Pedido(
                    id_cliente=cedula,
                    fecha_entrega=fecha_str,
                    estado="PENDIENTE" # Todo pedido masivo entra como pendiente
                )
                db.add(nuevo_pedido)
                db.flush() # Guardamos para que Python le asigne el ID de inmediato
                
                pedidos_creados[clave_agrupacion] = nuevo_pedido
                contadores["pedidos"] += 1

            # Recuperamos el Pedido Padre (ya sea el que acabamos de crear o uno de filas anteriores)
            pedido_actual = pedidos_creados[clave_agrupacion]

            # 5. Creamos el Detalle del Pedido (El producto que van a fabricar)
            nuevo_detalle = models.DetallePedido(
                id_pedido=pedido_actual.id_pedido,
                id_producto=id_prod,
                cantidad=cantidad
            )
            db.add(nuevo_detalle)
            contadores["productos"] += 1

        # Confirmamos la transacción completa
        db.commit()
        
        return {
            "mensaje": f"Se crearon {contadores['pedidos']} pedidos nuevos con un total de {contadores['productos']} productos a fabricar.",
            "errores": errores
        }

    except Exception as e:
        db.rollback() # Si el Excel tiene un formato destructivo, abortamos todo para proteger la BD
        raise HTTPException(status_code=500, detail=f"Error crítico procesando el archivo: {str(e)}")

# ==========================================
# OBTENER LISTA DE PROVEEDORES (GET)
# ==========================================
@app.get("/proveedores/", response_model=List[schemas.ProveedorResponse])
def obtener_proveedores(db: Session = Depends(get_db)):
    return db.query(models.Proveedor).all()

@app.post("/proveedores/", response_model=schemas.ProveedorResponse)
def crear_proveedor(proveedor: schemas.ProveedorCreate, db: Session = Depends(get_db)):
    nuevo_proveedor = models.Proveedor(**proveedor.model_dump())
    db.add(nuevo_proveedor)
    db.commit()
    db.refresh(nuevo_proveedor)
    return nuevo_proveedor

# 2. Asignar un nuevo precio de catálogo
@app.post("/precios-proveedor/")
def agregar_precio_material(precio: schemas.PrecioProveedorCreate, db: Session = Depends(get_db)):
    nuevo_precio = models.PrecioProveedor(**precio.model_dump())
    db.add(nuevo_precio)
    db.commit()
    return {"mensaje": "Precio del proveedor registrado con éxito."}

# 1. Actualizar nombre de la empresa
@app.put("/proveedores/{id_proveedor}")
def actualizar_proveedor(id_proveedor: int, prov_update: schemas.ProveedorUpdate, db: Session = Depends(get_db)):
    prov_db = db.query(models.Proveedor).filter(models.Proveedor.id_proveedor == id_proveedor).first()
    if not prov_db: raise HTTPException(status_code=404)
    if prov_update.nombre is not None: prov_db.nombre = prov_update.nombre
    db.commit()
    return {"mensaje": "Proveedor actualizado"}

# 2. Traer todos los precios que tiene registrados este proveedor
@app.get("/proveedores/{id_proveedor}/precios")
def obtener_precios_proveedor(id_proveedor: int, db: Session = Depends(get_db)):
    return db.query(models.PrecioProveedor).filter(models.PrecioProveedor.id_proveedor == id_proveedor).all()

# 3. Actualizar un precio específico
@app.put("/precios-proveedor/{id_precio}")
def actualizar_precio(id_precio: int, precio_update: schemas.PrecioProveedorUpdate, db: Session = Depends(get_db)):
    precio_db = db.query(models.PrecioProveedor).filter(models.PrecioProveedor.id_precio == id_precio).first()
    if not precio_db: raise HTTPException(status_code=404)
    if precio_update.precio_unitario is not None: precio_db.precio_unitario = precio_update.precio_unitario
    if precio_update.descuento_porcentaje is not None: precio_db.descuento_porcentaje = precio_update.descuento_porcentaje
    db.commit()
    return {"mensaje": "Precio actualizado"}

@app.get("/ordenes-compra/", response_model=List[schemas.OrdenCompraResponse])
def ver_ordenes_de_compra(db: Session = Depends(get_db)):
    return db.query(models.OrdenCompra).all()

@app.get("/ordenes-compra/{id_orden}/detalles", response_model=List[schemas.DetalleOrdenCompraResponse])
def ver_detalles_orden(id_orden: int, db: Session = Depends(get_db)):
    detalles = db.query(models.DetalleOrdenCompra).filter(models.DetalleOrdenCompra.id_orden_compra == id_orden).all()
    return detalles

@app.patch("/ordenes-compra/{id_orden}/estado")
def actualizar_estado_orden(id_orden: int, estado_update: schemas.EstadoOrdenUpdate, db: Session = Depends(get_db)):
    orden = db.query(models.OrdenCompra).filter(models.OrdenCompra.id_orden_compra == id_orden).first()
    if not orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")
    
    # 👇 LA MAGIA DE SUMAR AL INVENTARIO 👇
    if estado_update.estado == 'RECIBIDO' and orden.estado != 'RECIBIDO':
        detalles = db.query(models.DetalleOrdenCompra).filter(models.DetalleOrdenCompra.id_orden_compra == id_orden).all()
        for det in detalles:
            material = db.query(models.Material).filter(models.Material.id_material == det.id_material).first()
            if material:
                material.stock_actual += det.cantidad # 👈 ¡Sumamos lo comprado!
                print(f"✅ Recibido: Sumando {det.cantidad} a {material.nombre}. Nuevo stock: {material.stock_actual}")

    orden.estado = estado_update.estado
    db.commit()
    return {"mensaje": f"Orden actualizada a {orden.estado}"}


@app.put("/ordenes-compra/{id_orden}")
def editar_orden_compra(id_orden: int, orden_edit: schemas.OrdenEdicion, db: Session = Depends(get_db)):
    orden = db.query(models.OrdenCompra).filter(models.OrdenCompra.id_orden_compra == id_orden).first()
    if not orden:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    # Actualizamos el proveedor
    orden.id_proveedor = orden_edit.id_proveedor

    # Actualizamos las cantidades de cada material
    for det_edit in orden_edit.detalles:
        detalle_db = db.query(models.DetalleOrdenCompra).filter(models.DetalleOrdenCompra.id_detalle_compra == det_edit.id_detalle_compra).first()
        if detalle_db:
            detalle_db.cantidad = det_edit.cantidad

    db.commit()
    return {"mensaje": "Borrador actualizado correctamente"}

# ... (Mantén lo anterior) ...

# ==========================================
# RUTAS PARA PROGRAMACIÓN Y CONTROL DE HORAS
# ==========================================
# 👇 main.py 👇

@app.get("/planta/", response_model=List[schemas.OrdenPlantaResponse])
def obtener_ops_planta(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    # Traemos las OPs ordenadas por ID descendente (las más nuevas primero)
    return db.query(models.OrdenPlanta).order_by(models.OrdenPlanta.id_op.desc()).offset(skip).limit(limit).all()

@app.post("/planta/", response_model=schemas.OrdenPlantaResponse)
def crear_op_planta(op: schemas.OrdenPlantaCreate, db: Session = Depends(get_db)):
    nueva_op = models.OrdenPlanta(**op.model_dump())
    db.add(nueva_op)
    try:
        db.commit()
        db.refresh(nueva_op)
        return nueva_op
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error al crear OP. ¿Número de OP duplicado?")

@app.put("/planta/{id_op}", response_model=schemas.OrdenPlantaResponse)
def actualizar_op_planta(id_op: int, op_update: schemas.OrdenPlantaUpdate, db: Session = Depends(get_db)):
    op_db = db.query(models.OrdenPlanta).filter(models.OrdenPlanta.id_op == id_op).first()
    if not op_db:
        raise HTTPException(status_code=404, detail="OP no encontrada")

    update_data = op_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(op_db, key, value)

    db.commit()
    db.refresh(op_db)
    return op_db

# ==========================================
# RUTAS PARA MATERIALES E INVENTARIO
# ==========================================

# (Este ya lo tenías, es para crear materiales)
@app.post("/materiales/", response_model=schemas.MaterialResponse)
def crear_material(material: schemas.MaterialCreate, db: Session = Depends(get_db)):
    nuevo_material = models.Material(**material.model_dump())
    db.add(nuevo_material)
    db.commit()
    db.refresh(nuevo_material)
    return nuevo_material

# 👇 ESTE ES EL CÓDIGO NUEVO QUE DEBES AGREGAR 👇
@app.get("/materiales/", response_model=List[schemas.MaterialResponse])
def obtener_materiales(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    materiales = db.query(models.Material).offset(skip).limit(limit).all()
    return materiales
# 👆 HASTA AQUÍ 👆

# ==========================================
# RUTAS PARA EL DASHBOARD (KPIs)
# ==========================================
# 1. ACTUALIZA TU ENDPOINT EXISTENTE
@app.get("/dashboard/resumen/")
def obtener_resumen_dashboard(db: Session = Depends(get_db)):
    pedidos_activos = db.query(models.Pedido).filter(models.Pedido.estado != 'ENTREGADO').count()
    alertas_inventario = db.query(models.Material).filter(models.Material.stock_actual <= models.Material.stock_minimo_alerta).count()
    compras_pendientes = db.query(models.OrdenCompra).filter(models.OrdenCompra.estado.in_(['BORRADOR']) ).count()
    
    # 👇 NUEVA LÓGICA: Contar órdenes de producción nuevas 👇
    # (Ajusta 'models.OrdenProduccion' al nombre real de tu modelo)
    ordenes_nuevas = db.query(models.OrdenProduccion).filter(models.OrdenProduccion.vista_en_dashboard == False).count()

    return {
        "pedidos_activos": pedidos_activos,
        "alertas_inventario": alertas_inventario,
        "compras_pendientes": compras_pendientes,
        "ordenes_nuevas": ordenes_nuevas # 👈 LO ENVIAMOS A ANGULAR
    }

# 2. 👇 AGREGA ESTE NUEVO ENDPOINT 👇
@app.put("/dashboard/limpiar-notificacion-ordenes/")
def limpiar_notificacion_ordenes(db: Session = Depends(get_db)):
    # Buscamos todas las nuevas y las marcamos como vistas
    db.query(models.OrdenProduccion).filter(models.OrdenProduccion.vista_en_dashboard == False).update({"vista_en_dashboard": True})
    db.commit()
    return {"mensaje": "Notificaciones limpiadas"}
# ==========================================
# RUTAS DE REUNIONES
# ==========================================
@app.get("/reuniones/", response_model=List[schemas.ReunionResponse])
def obtener_reuniones(db: Session = Depends(get_db)):
    # Ordenamos por fecha y hora para que las más próximas salgan primero
    return db.query(models.Reunion).order_by(models.Reunion.fecha.asc(), models.Reunion.hora.asc()).all()

@app.post("/reuniones/", response_model=schemas.ReunionResponse)
def crear_reunion(reunion: schemas.ReunionCreate, db: Session = Depends(get_db)):
    nueva_reunion = models.Reunion(**reunion.model_dump())
    db.add(nueva_reunion)
    db.commit()
    db.refresh(nueva_reunion)
    return nueva_reunion

# 👇 main.py (Endpoint PUT Optimizado) 👇

@app.put("/reuniones/{id_reunion}", response_model=schemas.ReunionResponse)
def actualizar_reunion(id_reunion: int, reunion_update: schemas.ReunionUpdate, db: Session = Depends(get_db)):
    reunion_db = db.query(models.Reunion).filter(models.Reunion.id_reunion == id_reunion).first()
    if not reunion_db:
        raise HTTPException(status_code=404, detail="Reunión no encontrada")

    # 👇 ESTA ES LA MAGIA 👇
    # model_dump(exclude_unset=True) obtiene solo los campos que Angular envió, 
    # ignorando los predeterminados de Pydantic.
    update_data = reunion_update.model_dump(exclude_unset=True)
    
    # Recorremos el objeto y actualizamos dinámicamente cada campo
    for key, value in update_data.items():
        setattr(reunion_db, key, value)

    db.commit()
    db.refresh(reunion_db)
    return reunion_db
@app.get("/mantenimientos", response_model=List[schemas.MantenimientoResponse])
def obtener_mantenimientos(db: Session = Depends(get_db)):
    return db.query(models.Mantenimiento).order_by(models.Mantenimiento.fecha_mantenimiento.asc()).all()

@app.post("/mantenimientos", response_model=schemas.MantenimientoResponse)
def agendar_mantenimiento(mante: schemas.MantenimientoCreate, db: Session = Depends(get_db)):
    # Validar choque de fechas
    existe = db.query(models.Mantenimiento).filter(models.Mantenimiento.fecha_mantenimiento == mante.fecha_mantenimiento).first()
    if existe:
        raise HTTPException(status_code=400, detail="Ya existe un mantenimiento para este día. Elige otra fecha.")
    
    nuevo = models.Mantenimiento(**mante.model_dump())
    db.add(nuevo)
    db.commit()
    db.refresh(nuevo)
    return nuevo

@app.put("/mantenimientos/{id_mante}", response_model=schemas.MantenimientoResponse)
def actualizar_mantenimiento(id_mante: int, update: schemas.MantenimientoUpdate, db: Session = Depends(get_db)):
    mante_db = db.query(models.Mantenimiento).filter(models.Mantenimiento.id_mantenimiento == id_mante).first()
    if not mante_db:
        raise HTTPException(status_code=404, detail="Mantenimiento no encontrado")
    
    # Si intentan cambiar la fecha, verificar que no choque con otra
    if update.fecha_mantenimiento and update.fecha_mantenimiento != mante_db.fecha_mantenimiento:
        choque = db.query(models.Mantenimiento).filter(models.Mantenimiento.fecha_mantenimiento == update.fecha_mantenimiento).first()
        if choque:
            raise HTTPException(status_code=400, detail="La nueva fecha ya está ocupada por otro mantenimiento.")

    for key, value in update.model_dump(exclude_unset=True).items():
        setattr(mante_db, key, value)
    
    db.commit()
    db.refresh(mante_db)
    return mante_db

# 👇 main.py 👇

@app.get("/ordenes-produccion/", response_model=List[schemas.OrdenProduccionResponse])
def obtener_ordenes(db: Session = Depends(get_db)):
    return db.query(models.OrdenProduccion).order_by(models.OrdenProduccion.id_orden.desc()).all()

@app.post("/ordenes-produccion/", response_model=schemas.OrdenProduccionResponse)
def crear_orden(orden: schemas.OrdenProduccionCreate, db: Session = Depends(get_db)):
    nueva_orden = models.OrdenProduccion(**orden.model_dump())
    db.add(nueva_orden)
    try:
        db.commit()
        db.refresh(nueva_orden)
        return nueva_orden
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=400, detail="Error al crear. Verifica que el Número de OP no esté duplicado.")

@app.put("/ordenes-produccion/{id_orden}", response_model=schemas.OrdenProduccionResponse)
def actualizar_orden(id_orden: int, orden_update: schemas.OrdenProduccionUpdate, db: Session = Depends(get_db)):
    orden_db = db.query(models.OrdenProduccion).filter(models.OrdenProduccion.id_orden == id_orden).first()
    if not orden_db:
        raise HTTPException(status_code=404, detail="Orden no encontrada")

    update_data = orden_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(orden_db, key, value)

    db.commit()
    db.refresh(orden_db)
    return orden_db

@app.get("/kpis/ingresos", response_model=List[schemas.KpiIngresoResponse])
def get_kpi_ingresos(db: Session = Depends(get_db)):
    return db.query(models.KpiIngreso).order_by(models.KpiIngreso.anio.asc(), models.KpiIngreso.semana.asc()).all()

@app.post("/kpis/ingresos", response_model=schemas.KpiIngresoResponse)
def crear_kpi_ingresos(kpi: schemas.KpiIngresoCreate, db: Session = Depends(get_db)):
    neto = kpi.ingresos - kpi.egresos
    # Verificamos si ya existe la semana para actualizarla o crearla
    db_kpi = db.query(models.KpiIngreso).filter(models.KpiIngreso.semana == kpi.semana, models.KpiIngreso.anio == kpi.anio).first()
    
    if db_kpi:
        db_kpi.meta = kpi.meta
        db_kpi.ingresos = kpi.ingresos
        db_kpi.egresos = kpi.egresos
        db_kpi.neto = neto
    else:
        db_kpi = models.KpiIngreso(**kpi.model_dump(), neto=neto)
        db.add(db_kpi)
    
    db.commit()
    db.refresh(db_kpi)
    return db_kpi

@app.get("/kpis/productividad", response_model=List[schemas.KpiProductividadResponse])
def get_kpi_productividad(db: Session = Depends(get_db)):
    return db.query(models.KpiProductividad).order_by(models.KpiProductividad.anio.asc(), models.KpiProductividad.semana.asc()).all()

@app.post("/kpis/productividad", response_model=schemas.KpiProductividadResponse)
def crear_kpi_productividad(kpi: schemas.KpiProductividadCreate, db: Session = Depends(get_db)):
    db_kpi = db.query(models.KpiProductividad).filter(models.KpiProductividad.semana == kpi.semana, models.KpiProductividad.anio == kpi.anio).first()
    
    if db_kpi:
        db_kpi.meta_planchas = kpi.meta_planchas
        db_kpi.planchas_usadas = kpi.planchas_usadas
    else:
        db_kpi = models.KpiProductividad(**kpi.model_dump())
        db.add(db_kpi)
        
    db.commit()
    db.refresh(db_kpi)
    return db_kpi


@app.get("/kpis/ventas", response_model=List[schemas.KpiVentasResponse])
def get_kpi_ventas(db: Session = Depends(get_db)):
    return db.query(models.KpiVentas).order_by(models.KpiVentas.anio.asc(), models.KpiVentas.semana.asc()).all()

@app.post("/kpis/ventas", response_model=schemas.KpiVentasResponse)
def crear_kpi_ventas(kpi: schemas.KpiVentasCreate, db: Session = Depends(get_db)):
    # Verificamos si ya existe la semana para actualizarla o crearla
    db_kpi = db.query(models.KpiVentas).filter(models.KpiVentas.semana == kpi.semana, models.KpiVentas.anio == kpi.anio).first()
    
    if db_kpi:
        db_kpi.meta = kpi.meta
        db_kpi.ingresos = kpi.ingresos
    else:
        db_kpi = models.KpiVentas(**kpi.model_dump())
        db.add(db_kpi)
    
    db.commit()
    db.refresh(db_kpi)
    return db_kpi

@app.get("/kpis/gastos", response_model=List[schemas.KpiGastosResponse])
def get_kpi_gastos(db: Session = Depends(get_db)):
    return db.query(models.KpiGastos).order_by(models.KpiGastos.anio.asc(), models.KpiGastos.semana.asc()).all()

@app.post("/kpis/gastos", response_model=schemas.KpiGastosResponse)
def crear_kpi_gastos(kpi: schemas.KpiGastosCreate, db: Session = Depends(get_db)):
    db_kpi = db.query(models.KpiGastos).filter(models.KpiGastos.semana == kpi.semana, models.KpiGastos.anio == kpi.anio).first()
    
    if db_kpi:
        db_kpi.meta = kpi.meta
        db_kpi.gastos = kpi.gastos
    else:
        db_kpi = models.KpiGastos(**kpi.model_dump())
        db.add(db_kpi)
    
    db.commit()
    db.refresh(db_kpi)
    return db_kpi

@app.get("/kpis/cuentas-cobrar", response_model=List[schemas.KpiCuentasCobrarResponse])
def get_kpi_cuentas_cobrar(db: Session = Depends(get_db)):
    # Los ordenamos por año, semana y luego por ID para que salgan en orden de ingreso
    return db.query(models.KpiCuentasCobrar).order_by(models.KpiCuentasCobrar.anio.asc(), models.KpiCuentasCobrar.semana.asc(), models.KpiCuentasCobrar.id.asc()).all()

@app.post("/kpis/cuentas-cobrar", response_model=schemas.KpiCuentasCobrarResponse)
def crear_kpi_cuentas_cobrar(kpi: schemas.KpiCuentasCobrarCreate, db: Session = Depends(get_db)):
    db_kpi = db.query(models.KpiCuentasCobrar).filter(
        models.KpiCuentasCobrar.semana == kpi.semana, 
        models.KpiCuentasCobrar.anio == kpi.anio,
        models.KpiCuentasCobrar.nombre_persona == kpi.nombre_persona,
        models.KpiCuentasCobrar.tipo_movimiento == kpi.tipo_movimiento 
    ).first()
    
    if db_kpi:
        db_kpi.meta = kpi.meta
        # 👇 CORRECCIÓN AQUÍ: Convertimos a float para que Python nos deje sumarlos 👇
        db_kpi.monto = float(db_kpi.monto) + kpi.monto 
    else:
        db_kpi = models.KpiCuentasCobrar(**kpi.model_dump())
        db.add(db_kpi)
    
    db.commit()
    db.refresh(db_kpi)
    return db_kpi

@app.get("/proformas/", response_model=List[schemas.ProformaResponse])
def obtener_proformas(db: Session = Depends(get_db)):
    return db.query(models.Proforma).order_by(models.Proforma.id_proforma.desc()).all()

@app.post("/proformas/", response_model=schemas.ProformaResponse)
def crear_proforma(proforma: schemas.ProformaCreate, db: Session = Depends(get_db)):
    nueva_proforma = models.Proforma(**proforma.model_dump())
    db.add(nueva_proforma)
    
    # 👇 AJUSTE: Le agregamos "orden_produccion": 0 para evitar errores con el nuevo esquema 👇
    equipos_para_op = [{"cantidad": d.cantidad, "descripcion": d.descripcion, "orden_produccion": 0} for d in proforma.detalles]
    
    import time
    numero_borrador = f"DRAFT-{proforma.numero_proforma}-{int(time.time())}"

    orden_borrador = models.OrdenProduccion(
        numero_op=numero_borrador,
        cliente_nombre=proforma.cliente_nombre,
        cliente_direccion=proforma.cliente_direccion,
        fecha_pedido=proforma.fecha_emision,
        descripcion_pedido=proforma.trabajo,
        equipos=equipos_para_op,
        precio_total=proforma.precio_total,
        forma_pago=None, 
        saldo=proforma.precio_total,
        vista_en_dashboard=False 
    )
    db.add(orden_borrador)
    
    try:
        db.commit()
        db.refresh(nueva_proforma)
        return nueva_proforma
    except Exception as e:
        db.rollback()
        print(f"🚨 ERROR FATAL EN BD: {str(e)}") 
        raise HTTPException(status_code=400, detail=f"Error interno: {str(e)}")


# 👇 NUEVA FUNCIÓN PARA ACTUALIZAR PROFORMA Y SINCRONIZAR OP 👇
@app.put("/proformas/{id_proforma}", response_model=schemas.ProformaResponse)
def actualizar_proforma(id_proforma: int, proforma_update: schemas.ProformaUpdate, db: Session = Depends(get_db)):
    proforma_db = db.query(models.Proforma).filter(models.Proforma.id_proforma == id_proforma).first()
    if not proforma_db:
        raise HTTPException(status_code=404, detail="Proforma no encontrada")

    # 1. Actualizamos los datos de la Proforma
    update_data = proforma_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(proforma_db, key, value)

    # 2. Buscamos el borrador de OP generado por esta proforma
    # Usamos LIKE porque el borrador tiene formato: DRAFT-PR001-17154...
    orden_borrador = db.query(models.OrdenProduccion).filter(
        models.OrdenProduccion.numero_op.like(f"DRAFT-{proforma_db.numero_proforma}-%")
    ).first()

    # Si existe el borrador, le inyectamos los nuevos datos
    if orden_borrador:
        if "cliente_nombre" in update_data: orden_borrador.cliente_nombre = update_data["cliente_nombre"]
        if "cliente_direccion" in update_data: orden_borrador.cliente_direccion = update_data["cliente_direccion"]
        if "fecha_emision" in update_data: orden_borrador.fecha_pedido = update_data["fecha_emision"]
        if "trabajo" in update_data: orden_borrador.descripcion_pedido = update_data["trabajo"]
        if "precio_total" in update_data: 
            orden_borrador.precio_total = update_data["precio_total"]
            orden_borrador.saldo = update_data["precio_total"]
        if "detalles" in update_data:
            orden_borrador.equipos = [{"cantidad": d["cantidad"], "descripcion": d["descripcion"], "orden_produccion": 0} for d in update_data["detalles"]]

    try:
        db.commit()
        db.refresh(proforma_db)
        return proforma_db
    except Exception as e:
        db.rollback()
        print(f"🚨 ERROR ACTUALIZANDO BD: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Error interno: {str(e)}")