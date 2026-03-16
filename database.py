
# Dependencia para obtener la sesión de la base de datos en cada petición
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 1. Intentamos leer la URL de la nube (Vercel). 
# Si no existe, usamos la de Neon que acabas de copiar.
# (Recuerda poner tu URL real aquí abajo para probar)
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://neondb_owner:npg_XRqUD83KNJHk@ep-small-thunder-adi2s720-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
)
# ⚠️ NOTA: Si la URL de Neon empieza con 'postgres://', 
# cámbiala manualmente a 'postgresql://' para que SQLAlchemy no se queje.

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()