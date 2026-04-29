from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import date
from typing import List
import database, models, schemas

import logging
import traceback

try:
    models.Base.metadata.create_all(bind=database.engine)
    print("--- DATABASE CONNECTED AND TABLES VERIFIED ---")
except Exception as e:
    print(f"--- ERROR CONNECTING TO DATABASE: {e} ---")
    print("POSSIBLE CAUSE: Your Supabase free project might be paused due to inactivity, or the DATABASE_URL is incorrect.")

app = FastAPI(title="Sistema NUIAM API", description="Gestão de Macromedição e Telemetria")

print("--- RESTARTING NUIAM BACKEND ---")

# Configurar CORS para o Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def calculate_status(asset: models.Asset) -> str:
    if asset.failure_reported:
        return "Critico" # Vermelho
        
    if getattr(asset, "preventive_requested", False):
        return "Preventiva" # Amarelo
    
    days_since_maintenance = (date.today() - asset.last_maintenance).days
    if days_since_maintenance > 180:
        return "Preventiva" # Amarelo
        
    return "Operacional" # Verde

def send_notification(asset_tag: str, status: str, issue: str = None):
    # STUB: Aqui entraria a integração real com SendGrid (Email) ou Twilio/Wpp API
    print(f"\n[NOTIFICAÇÃO ENVIADA VIA WHATSAPP/EMAIL]")
    print(f"Alerta do Ativo {asset_tag} - Status: {status}")
    if issue:
        print(f"Detalhe: {issue}")
    print("-------------------------------------------\n")

# -- ROTAS DE AUTENTICAÇÃO E USUÁRIOS --

@app.post("/api/auth/login", response_model=schemas.UserResponse)
def login(creds: schemas.LoginRequest, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.username == creds.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado no sistema.")
    if user.password_hash != creds.password:
        raise HTTPException(status_code=401, detail="Senha incorreta. Tente novamente.")
    if not user.is_approved:
        raise HTTPException(status_code=403, detail="Acesso não liberado. Aguarde a aprovação de um chefe.")
    return user

@app.post("/api/auth/request-access", response_model=schemas.UserResponse)
def request_access(user_req: schemas.UserCreate, db: Session = Depends(database.get_db)):
    # Verifica se já existe username
    exists = db.query(models.User).filter(models.User.username == user_req.username).first()
    if exists:
        raise HTTPException(status_code=400, detail="Nome de usuário já existe.")
        
    db_user = models.User(
        full_name=user_req.full_name,
        username=user_req.username,
        password_hash=user_req.password,
        role="usuário externo",
        is_approved=False
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

@app.get("/api/users", response_model=List[schemas.UserResponse])
def get_users(db: Session = Depends(database.get_db)):
    return db.query(models.User).filter(models.User.is_approved == True).all()

@app.get("/api/users/pending", response_model=List[schemas.UserResponse])
def get_pending_users(db: Session = Depends(database.get_db)):
    return db.query(models.User).filter(models.User.is_approved == False).all()

@app.put("/api/users/{user_id}/approve", response_model=schemas.UserResponse)
def approve_user(user_id: int, role: str, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    
    user.is_approved = True
    user.role = role
    db.commit()
    db.refresh(user)
    return user

@app.put("/api/users/{user_id}/password")
def change_password(user_id: int, passwords: schemas.PasswordChangeRequest, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if user.password_hash != passwords.current_password:
        raise HTTPException(status_code=400, detail="Senha atual incorreta.")
    
    user.password_hash = passwords.new_password
    db.commit()
    return {"message": "Senha atualizada com sucesso!"}

@app.put("/api/users/{user_id}/icon", response_model=schemas.UserResponse)
def change_icon(user_id: int, request: schemas.UserUpdateIcon, db: Session = Depends(database.get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    user.icon = request.icon
    db.commit()
    db.refresh(user)
    return user

# -- ROTAS DO NEGÓCIO --

@app.get("/api/cities", response_model=List[schemas.CityResponse])
def get_cities(db: Session = Depends(database.get_db)):
    cities = db.query(models.City).all()
    # Populate the status dynamically for nested assets
    result = []
    for city in cities:
        city_resp = schemas.CityResponse.model_validate(city)
        for sys in city_resp.systems:
            for ast in sys.assets:
                # Need to calculate this for the response
                asset_db = db.query(models.Asset).filter(models.Asset.id == ast.id).first()
                if asset_db:
                    ast.status = calculate_status(asset_db)
        result.append(city_resp)
    return result

@app.get("/api/assets", response_model=List[schemas.AssetResponse])
def list_assets(db: Session = Depends(database.get_db)):
    assets = db.query(models.Asset).all()
    result = []
    for asset in assets:
        resp = schemas.AssetResponse.model_validate(asset)
        resp.status = calculate_status(asset)
        result.append(resp)
    return result

@app.get("/api/dashboard")
def get_dashboard(db: Session = Depends(database.get_db)):
    assets = db.query(models.Asset).all()
    greens = 0
    yellows = 0
    reds = 0
    
    boss_panel = []

    for asset in assets:
        status = calculate_status(asset)
        if status == "Operacional":
            greens += 1
        elif status == "Preventiva":
            yellows += 1
        else:
            reds += 1
        
        system = db.query(models.System).filter(models.System.id == asset.system_id).first()
        city = db.query(models.City).filter(models.City.id == system.city_id).first() if system else None
        
        boss_panel.append({
            "id": asset.id,
            "tag": asset.tag,
            "category": asset.category,
            "system_name": system.name if system else "N/A",
            "city_name": city.name if city else "N/A",
            "status": status,
            "last_maintenance": asset.last_maintenance,
            "criticality": 3 if status == "Critico" else 2 if status == "Preventiva" else 1,
            "priority_score": asset.priority_score,
            "kanban_status": asset.kanban_status
        })
    
    # Ordenar por criticidade e depois por priority score
    boss_panel.sort(key=lambda x: (x["criticality"] * 10) + x["priority_score"], reverse=True)

    return {
        "summary": {
            "green": greens,
            "yellow": yellows,
            "red": reds,
            "total": greens + yellows + reds
        },
        "boss_panel": boss_panel
    }

@app.post("/api/services", response_model=schemas.Service)
def create_service(service: schemas.ServiceCreate, background_tasks: BackgroundTasks, db: Session = Depends(database.get_db)):
    service_data = service.model_dump()
    user_ids = service_data.pop("user_ids", [])
    
    if "date" in service_data and service_data["date"] is None:
        service_data.pop("date")
        
    db_service = models.Service(**service_data)
    
    if user_ids:
        users = db.query(models.User).filter(models.User.id.in_(user_ids)).all()
        db_service.users = users
        
    db.add(db_service)
    
    # Atualizar asset
    asset = db.query(models.Asset).filter(models.Asset.id == service.asset_id).first()
    if asset:
        asset.last_maintenance = date.today()
        # Se um serviço for registrado, move automaticamente o card do Kanban para 'done', limpa erro e reseta urgência
        asset.kanban_status = 'done'
        asset.failure_reported = False
        asset.preventive_requested = False
        asset.priority_score = 0
             
        # Checagens para Notificação
        if service.macro_type.lower() == "preventiva" and asset.failure_reported == True:
            background_tasks.add_task(send_notification, asset.tag, "CRÍTÍCO", "Manutenção preventiva feita mas equipamento relatou falhas no checklist.")
        
        # Simulando uma regra de gatilho de notificação
        if service.electrical_interferences:
            background_tasks.add_task(send_notification, asset.tag, "ALERTA", "Técnico reportou interferências elétricas graves no local!")

    
    db.commit()
    db.refresh(db_service)
    return db_service

@app.put("/api/services/{service_id}/date")
def update_service_date(service_id: int, service_update: schemas.ServiceUpdateDate, db: Session = Depends(database.get_db)):
    db_service = db.query(models.Service).filter(models.Service.id == service_id).first()
    if not db_service:
        raise HTTPException(status_code=404, detail="Serviço não encontrado")
    
    db_service.date = service_update.date
    
    # Atualiza o last_maintenance do asset se a data for atualizada
    asset = db.query(models.Asset).filter(models.Asset.id == db_service.asset_id).first()
    if asset:
        latest_service = db.query(models.Service).filter(models.Service.asset_id == asset.id).order_by(models.Service.date.desc()).first()
        if latest_service:
             asset.last_maintenance = latest_service.date
             
    db.commit()
    return {"message": "Data do serviço atualizada com sucesso"}

@app.get("/api/assets/{asset_id}", response_model=schemas.AssetWithHistoryResponse)
def get_asset(asset_id: int, db: Session = Depends(database.get_db)):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Ativo não encontrado")
    
    resp = schemas.AssetWithHistoryResponse.model_validate(asset)
    resp.status = calculate_status(asset)
    # Ensure services are ordered by date descending
    resp.services = sorted(asset.services, key=lambda s: s.date, reverse=True)
    return resp

@app.post("/api/assets", response_model=schemas.AssetResponse)
def create_asset(asset: schemas.AssetCreate, db: Session = Depends(database.get_db)):
    db_asset = models.Asset(**asset.model_dump())
    db.add(db_asset)
    db.commit()
    db.refresh(db_asset)
    resp = schemas.AssetResponse.model_validate(db_asset)
    resp.status = calculate_status(db_asset)
    return resp

@app.put("/api/assets/{asset_id}/priority")
def update_priority(asset_id: int, score: int, db: Session = Depends(database.get_db)):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Ativo não encontrado")
    
    asset.priority_score = score
    db.commit()
    return {"message": "Prioridade atualizada com sucesso", "priority_score": score}

@app.put("/api/assets/{asset_id}/kanban")
def update_kanban(asset_id: int, status: str, db: Session = Depends(database.get_db)):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Ativo não encontrado")
    
    # Validar status
    valid_statuses = ["backlog", "todo", "in_progress", "done"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Status Kanban inválido")

    asset.kanban_status = status
    
    # Ao ser movido para 'Concluído', restaura e zera toda urgência/alarme do Ativo
    if status == 'done':
        asset.failure_reported = False
        asset.preventive_requested = False
        asset.priority_score = 0
        asset.last_maintenance = date.today()
        
    db.commit()
    return {"message": "Kanban atualizado com sucesso", "kanban_status": status}

class AnomalyCreate(schemas.BaseModel):
    description: str

@app.post("/api/assets/{asset_id}/anomaly")
def report_anomaly(asset_id: int, anomaly: AnomalyCreate, background_tasks: BackgroundTasks, db: Session = Depends(database.get_db)):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Ativo não encontrado")
    
    # Elevar a urgência e inserir no quadro de próximas demandas
    asset.failure_reported = True
    asset.priority_score = 5
    asset.kanban_status = 'todo' # Vai direto para o mural Kanban 'A Fazer'
    
    # Criar um serviço corretivo apenas para histórico da anomalia relatada (vazão zero etc)
    # Isso fará a anomalia aparecer no histórico do ativo
    db_service = models.Service(
        asset_id=asset.id,
        macro_type="Corretiva",
        category="Outros",
        materials_used=f"[Anomalia Registrada via Alerta NUIAM]: {anomaly.description}"
    )
    db.add(db_service)
    db.commit()
    
    # Notificação
    background_tasks.add_task(send_notification, asset.tag, "CRÍTÍCO", f"Uma anomalia grave foi reportada: {anomaly.description}")
    
    return {"message": "Anomalia registrada, urgência elevada e ativo movido para Próximas Demandas no Kanban."}

class PreventiveCreate(schemas.BaseModel):
    description: str

@app.post("/api/assets/{asset_id}/preventive")
def request_preventive(asset_id: int, req: PreventiveCreate, background_tasks: BackgroundTasks, db: Session = Depends(database.get_db)):
    asset = db.query(models.Asset).filter(models.Asset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Ativo não encontrado")
    
    asset.preventive_requested = True
    asset.kanban_status = "todo"
    asset.priority_score = max(asset.priority_score or 0, 2)
    
    svc = models.Service(
        asset_id=asset.id,
        macro_type="Preventiva",
        category="Solicitação Operacional",
        date=date.today(),
        materials_used=f"[Solicitação de Preventiva via Sistema] {req.description}"
    )
    db.add(svc)
    db.commit()
    db.refresh(asset)
    
    return {"message": "Solicitação de preventiva ativada e equipamento movido para A Fazer"}

@app.post("/api/demands")
def assign_demand(demand: schemas.DemandCreate, background_tasks: BackgroundTasks, db: Session = Depends(database.get_db)):
    asset = db.query(models.Asset).filter(models.Asset.id == demand.asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Ativo não encontrado")
    
    sys = db.query(models.System).filter(models.System.id == asset.system_id).first()
    city = db.query(models.City).filter(models.City.id == sys.city_id).first()

    # Buscar outros ativos no MESMO sistema que precisam de preventiva
    other_assets = db.query(models.Asset).filter(
        models.Asset.system_id == asset.system_id,
        models.Asset.id != asset.id
    ).all()

    preventive_suggestions = []
    for other in other_assets:
        status = calculate_status(other)
        if status in ["Preventiva", "Critico"]:
            preventive_suggestions.append(f"- {other.tag} ({other.category}) : Status {status} (Últ. Manut: {other.last_maintenance.strftime('%d/%m/%Y')})")

    # Montar email
    email_body = f"Olá {demand.technician_name},\n\n"
    email_body += f"Você tem uma nova demanda designada pelo seu Chefe para o ativo {asset.tag} ({asset.category}) no Sistema {sys.name} ({city.name}).\n"
    email_body += f"Descrição da Demanda Primária:\n'{demand.description}'\n\n"
    
    if preventive_suggestions:
        email_body += "💡 SUGESTÃO DO NUIAM: OTIMIZAÇÃO DE ROTEIRO\n"
        email_body += "Como você já irá se deslocar para esse sistema, aproveite e realize manutenção (preventiva ou corretiva) nos seguintes equipamentos locais que estão vencidos ou críticos:\n"
        email_body += "\n".join(preventive_suggestions)
    else:
        email_body += "✅ Todos os outros equipamentos desta estação estão operacionais. Nenhuma preventiva extra necessária."

    background_tasks.add_task(send_notification, asset.tag, "NOVA DEMANDA & ROTEIRO", email_body)
    
    return {"message": "Demanda atribuída e notificação de roteiro enviada com sucesso!"}

@app.get("/api/reports")
def generate_report(start_date: date = None, end_date: date = None, db: Session = Depends(database.get_db)):
    query = db.query(models.Service, models.Asset, models.System, models.City)\
        .join(models.Asset, models.Service.asset_id == models.Asset.id)\
        .join(models.System, models.Asset.system_id == models.System.id)\
        .join(models.City, models.System.city_id == models.City.id)
    
    if start_date:
        query = query.filter(models.Service.date >= start_date)
    if end_date:
        query = query.filter(models.Service.date <= end_date)
        
    results = query.all()
    
    report_data = []
    for svc, asset, sys, city in results:
        report_data.append({
            "Data da Manutencao": svc.date.strftime('%Y-%m-%d'),
            "Sistema Geral": city.name,
            "Subsistema / Localidade": sys.name,
            "Tag do Ativo": asset.tag,
            "Categoria Ativo": asset.category,
            "Tipo Manutencao": svc.macro_type,
            "Categoria Servico": svc.category,
            "Resolvido Local": "Sim", 
            "Material/Tubulacao": f"{svc.piping_material} ({svc.diameter_mm}mm)" if svc.piping_material else "",
            "Influencias Naturais": svc.natural_influences or "",
            "Interferencia Eletrica": "Sim" if svc.electrical_interferences else "Não",
            "Pecas Substituidas": svc.replaced_parts or "",
            "Anotacoes": svc.materials_used or ""
        })
        
    return {"data": report_data}

@app.get("/api/predict_ml")
def placeholder_ml_prediction():
    # Model placeholder
    # Preparação para receber modelo Scikit-learn/XGBoost para análise de histórico de umidade/interferência
    return {"message": "Modelo de ML será integrado aqui."}
