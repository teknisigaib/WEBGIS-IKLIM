from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
from config import Base
from datetime import datetime, timezone

class MapMetadata(Base):
    """Tabel Induk: Menyimpan info peta dan URL/Path gambar"""
    __tablename__ = "map_metadata"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True)
    category = Column(String, index=True)
    period = Column(String)
    update_time = Column(String)
    analysis_text = Column(Text, nullable=True)
    
    # Cuma nyimpen URL/Path lokasi file (BUKAN file fisiknya)
    geojson_url = Column(String, nullable=True)
    png_url = Column(String, nullable=True)
    tif_url = Column(String, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relasi ke tabel data spasial (anak)
    features = relationship("MapFeature", back_populates="metadata_parent", cascade="all, delete")

class MapFeature(Base):
    """Tabel Anak: Menyimpan nilai curah hujan/HTH dan titik koordinat/poligon aslinya (PostGIS)"""
    __tablename__ = "map_features"

    id = Column(Integer, primary_key=True, index=True)
    map_id = Column(Integer, ForeignKey("map_metadata.id", ondelete="CASCADE"))
    
    val = Column(Float, nullable=True)
    category_label = Column(String, nullable=True)
    
    # Bintang utamanya: Tipe GEOMETRY PostGIS! (SRID 4326 = format koordinat GPS standar / LatLon)
    geom = Column(Geometry(geometry_type='GEOMETRY', srid=4326))

    metadata_parent = relationship("MapMetadata", back_populates="features")