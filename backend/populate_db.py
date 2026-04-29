import datetime
from sqlalchemy.orm import Session
import database, models

raw_data = """
RMG - SAA - São Miguel do Gostoso - PT02
RMG - SAA - São Miguel do Gostoso - REL
RMG - SAA Bento Fernandes - EERP1
RMG - SAA Bento Fernandes - EERP2
RMG - SAA Jandaira - PT 02
RMG - SAA Jandaira - PT 05
RMG - SAA Jandaira - PT 08
RMG - SAA Joao Camara - RAP
RMG - SAA Joao Camara - REL
RMG - SAA Macaiba - EEAT1 GMB
RMG - SAA Macaiba - EEAT1/EEAT2
RMG - SAA Macaiba - EERP Paulino
RMG - SAA Macaiba - EERP Raiz
RMG - SAA Macaiba - EERPRT(Reta Tabaj)
RMG - SAA Macaiba - PT Guarapes
RMG - SAA Macaiba - PT Pé do Galo
RMG - SAA Macaiba - PT05
RMG - SAA Macaiba - PT07
RMG - SAA Macaiba - PT08
RMG - SAA Macaiba - PT09
RMG - SAA Macaiba - PT10
RMG - SAA Macaiba - PT11
RMG - SAA Macaiba - PT13
RMG - SAA Macaiba - PT14
RMG - SAA Macaiba - PT15
RMG - SAA Macaiba - PT16
RMG - SAA Macaiba - PT17
RMG - SAA Macaiba - PT18
RMG - SAA Macaiba - PT19
RMG - SAA Macaiba - PT21
RMG - SAA Macaiba - PT24
RMG - SAA Macaiba - REL1/EERP2
RMG - SAA Macaiba - REL2
RMG - SAA Parazinho - UM01
RMG - SAA Parazinho - UM03
RMG - SAA Pedra Grande - EERP Enxu
RMG - SAA Pedra Grande - REL1
RMG - SAA Poço Branco
RMG - SAA Santa Maria
RMG - SAABentoFernandes
RMG - SAACaicaraNorte
RMG - SAARiachuelo - P01
RMG - SAARiachuelo - P02
RMG - SAARiachuelo - P03
RMG - SAARiachuelo - P04
RMG - SAASaoBentoNorte
RMG - SAATaipu
RMG - SES Macaiba - EEE Campinas
RMG - SES Macaiba - EEE CIA
RMG - SES Macaiba - ETE CIA
SPI Boqueirão - EEAT1
SPI Boqueirão - PT01
SPI Boqueirão - PT02
SPI Boqueirão - PT03
SPI Boqueirão - PT04
SPI Boqueirão - RAP Caixa de Passagem
SPI Pureza/João Camara - EEAT1 - GMB
SPI Pureza/João Camara - EEAT1 - MM
SPI Pureza/João Camara - Entronc
SPI Pureza/João Camara - UMFSL
SPI Pureza/João Camara - UMPonte
SPI Sertão Central - EEAT3
SPI Sertão Central - EERP01 SG
SPI Sertão Central - ETA(EEAB1)
SPI Sertão Central - RAP(Pico)
SPI Sertão Central - SAA Cachoeira Sapo
SPI Sertão Central - SAA Caiçara
SPI Sertão Central - SAA J. Angicos
SPI Sertão Central - SAA Lajes
SPI Sertão Central - SAA Pedra Preta
SPI Sertão Central - SAA Riachuelo
"""

def parse_line(line):
    line = line.strip()
    if not line:
        return None
    
    system = ""
    subsystem = ""
    asset = ""

    if line.startswith("RMG - "):
        line = line.replace("RMG - ", "")
        if line.startswith("SAA - "):
            system = "SAA"
            rest = line.replace("SAA - ", "").split(" - ")
            subsystem = rest[0].strip()
            asset = " - ".join(rest[1:]).strip() if len(rest) > 1 else "Principal"
        elif line.startswith("SAA "):
            system = "SAA"
            rest = line.replace("SAA ", "").split(" - ")
            subsystem = rest[0].strip()
            asset = " - ".join(rest[1:]).strip() if len(rest) > 1 else "Principal"
        elif line.startswith("SES "):
            system = "SES"
            rest = line.replace("SES ", "").split(" - ")
            subsystem = rest[0].strip()
            asset = " - ".join(rest[1:]).strip() if len(rest) > 1 else "Principal"
        elif line.startswith("SAABentoFernandes"):
            system = "SAA"
            subsystem = "Bento Fernandes"
            asset = "Principal"
        elif line.startswith("SAACaicaraNorte"):
            system = "SAA"
            subsystem = "Caicara Norte"
            asset = "Principal"
        elif line.startswith("SAARiachuelo"):
            system = "SAA"
            subsystem = "Riachuelo"
            asset = line.replace("SAARiachuelo - ", "").strip() if " - " in line else "Principal"
        elif line.startswith("SAASaoBentoNorte"):
            system = "SAA"
            subsystem = "Sao Bento Norte"
            asset = "Principal"
        elif line.startswith("SAATaipu"):
            system = "SAA"
            subsystem = "Taipu"
            asset = "Principal"
        else:
            system = "Outros"
            subsystem = line
            asset = "Principal"
    elif line.startswith("SPI "):
        system = "SPI"
        rest = line.replace("SPI ", "").split(" - ")
        subsystem = rest[0].strip()
        asset = " - ".join(rest[1:]).strip() if len(rest) > 1 else "Principal"
    else:
        system = "Desconhecido"
        subsystem = line
        asset = "Principal"

    return system, subsystem, asset

def seed():
    # models.Base.metadata.drop_all(bind=database.engine)
    models.Base.metadata.create_all(bind=database.engine)
    db = Session(database.engine)

    # Clear tables safely to avoid PostgreSQL drop_all lock
    db.query(models.Service).delete()
    db.query(models.Asset).delete()
    db.query(models.System).delete()
    db.query(models.City).delete()
    db.query(models.User).delete()
    db.commit()

    # Users
    u1 = models.User(full_name="Mikael", username="mikael", password_hash="mudar@123", role="desenvolvedor", is_approved=True)
    u2 = models.User(full_name="Augusto", username="augusto", password_hash="mudar@123", role="chefe", is_approved=True)
    u3 = models.User(full_name="Arthur", username="arthur", password_hash="mudar@123", role="técnico", is_approved=True)
    u4 = models.User(full_name="Jordan", username="jordan", password_hash="mudar@123", role="estagiário", is_approved=True)
    db.add_all([u1, u2, u3, u4])
    db.commit()

    systems_cache = {}
    subsystems_cache = {}

    today = datetime.date.today()
    green_date = today - datetime.timedelta(days=30)
    yellow_date = today - datetime.timedelta(days=190)

    assets_to_add = []

    for line in raw_data.strip().split('\n'):
        parsed = parse_line(line)
        if not parsed:
            continue
        sys_name, subsys_name, asset_name = parsed

        if sys_name not in systems_cache:
            new_sys = models.City(name=sys_name)
            db.add(new_sys)
            db.commit()
            db.refresh(new_sys)
            systems_cache[sys_name] = new_sys
        
        sys_obj = systems_cache[sys_name]

        sub_key = f"{sys_name}-{subsys_name}"
        if sub_key not in subsystems_cache:
            new_sub = models.System(name=subsys_name, city_id=sys_obj.id)
            db.add(new_sub)
            db.commit()
            db.refresh(new_sub)
            subsystems_cache[sub_key] = new_sub
        
        sub_obj = subsystems_cache[sub_key]

        cat = "Outros"
        lower_asset = asset_name.lower()
        if "pt" in lower_asset or "poço" in lower_asset:
            cat = "Poço"
        elif "eeat" in lower_asset or "eee" in lower_asset or "eeab" in lower_asset or "ete" in lower_asset or "eerp" in lower_asset:
            cat = "Elevatória"
        elif "rel" in lower_asset:
            cat = "Outros"
        elif "captação" in lower_asset:
            cat = "Captação"
        elif "rap" in lower_asset:
            cat = "Reservatório"
        
        assets_to_add.append(models.Asset(
            tag=asset_name,
            category=cat,
            system_id=sub_obj.id,
            last_maintenance=green_date
        ))

    db.add_all(assets_to_add)
    db.commit()
    print("Banco de dados atualizado com a nova nomenclatura!")

if __name__ == "__main__":
    seed()
