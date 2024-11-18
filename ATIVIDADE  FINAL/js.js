class User {
  constructor(name, role) {
    this.name = name;
    this.role = role;
  }

  canEdit() {
    return ['admin', 'operator'].includes(this.role);
  }

  canDelete() {
    return this.role === 'admin';
  }

  canAddComments() {
    return this.role !== 'consultant';
  }
}

class VehicleManager {
  constructor() {
    this.vehicles = [];
    this.users = [
      new User('Felipe', 'admin'),
      new User('Tiago', 'operator'),
      new User('Pedro', 'consultant')
    ];
    this.currentUser = this.users[0];
    this.itemsPerPage = 5;
    this.currentPage = 1;
    this.init();
  }

  updateUserInfo() {
    const userNameElement = document.getElementById('currentUserName');
    const userRoleElement = document.getElementById('currentUserRole');
    
    if (userNameElement && userRoleElement) {
      userNameElement.textContent = this.currentUser.name;
      userRoleElement.textContent = this.currentUser.role.toUpperCase();
      userRoleElement.className = `role-badge role-${this.currentUser.role}`;
    }
  }

  init() {
    this.form = document.getElementById('vehicleForm');
    this.list = document.getElementById('vehicleList');
    this.teamList = document.getElementById('teamList');
    
    this.setupEventListeners();
    this.setupUserSelector();
    this.setupFilters();
    this.loadVehicles();
    this.renderTeamMembers();
    
    // Show listagem by default
    this.showSection('listagem');
    this.updateUserInfo();
  }

  showSection(sectionId) {
    // Hide all sections first
    ['cadastro', 'listagem', 'teamSection'].forEach(id => {
      const section = document.getElementById(id);
      if (section) section.style.display = 'none';
    });

    // Show requested section
    const section = document.getElementById(sectionId);
    if (section) {
      section.style.display = 'block';
      
      // Update content if needed
      if (sectionId === 'listagem') {
        this.renderVehicles();
      } else if (sectionId === 'teamSection') {
        this.renderTeamMembers();
      }
    }
  }

  setupUserSelector() {
    const selector = document.getElementById('userSelector');
    selector.innerHTML = this.users.map(user => `
      <option value="${user.name}">${user.name} (${user.role})</option>
    `).join('');
    
    selector.addEventListener('change', (e) => {
      const selectedUser = this.users.find(u => u.name === e.target.value);
      if (selectedUser) {
        this.currentUser = selectedUser;
        this.updateUserInfo();
        this.renderVehicles(); // Re-render to update permissions
        this.renderTeamMembers(); // Re-render team list
      }
    });
  }

  setupEventListeners() {
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      
      if (!this.currentUser.canEdit()) {
        this.showFeedback('Você não tem permissão para esta ação', 'danger');
        return;
      }

      // Check if we're editing or creating new
      if (this.form.dataset.editingId) {
        // Edit mode - do nothing as it's handled by edit form submit handler
        return;
      } else {
        // Create mode
        this.addVehicle();
      }
    });

    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        // Remove active class from all tabs
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        
        const tabName = e.target.dataset.tab;
        
        // Hide all sections first
        ['cadastro', 'listagem', 'teamSection'].forEach(id => {
          const section = document.getElementById(id);
          if (section) section.style.display = 'none';
        });

        if (tabName === 'vehicles') {
          document.getElementById('vehiclesMenu').style.display = 'block';
          document.getElementById('teamMenu').style.display = 'none';
          // Show listagem by default when switching to vehicles tab
          this.showSection('listagem');
        } else if (tabName === 'team') {
          document.getElementById('vehiclesMenu').style.display = 'none';
          document.getElementById('teamMenu').style.display = 'block';
          document.getElementById('teamSection').style.display = 'block';
          this.renderTeamMembers();
        }
      });
    });
  }

  validateVehicle(vehicle) {
    const currentYear = new Date().getFullYear();
    const errors = [];
    
    if (vehicle.ano < 1900 || vehicle.ano > currentYear + 1) {
      errors.push(`Ano deve estar entre 1900 e ${currentYear + 1}`);
    }
    
    if (this.vehicles.some(v => v.registro === vehicle.registro)) {
      errors.push('Número de registro já existe');
    }
    
    return errors;
  }

  showFeedback(message, type = 'success') {
    const feedback = document.createElement('div');
    feedback.className = `alert alert-${type}`;
    feedback.textContent = message;
    
    const container = document.querySelector('.container');
    container.insertBefore(feedback, container.firstChild);
    
    setTimeout(() => feedback.remove(), 3000);
  }

  addVehicle() {
    const vehicle = {
      id: Date.now(),
      marca: document.getElementById('marca').value,
      modelo: document.getElementById('modelo').value,
      ano: document.getElementById('ano').value,
      cor: document.getElementById('cor').value,
      registro: document.getElementById('registro').value,
      responsavel: this.currentUser.name,
      comentarios: [],
      historico: [{
        acao: 'Cadastro',
        usuario: this.currentUser.name,
        data: new Date().toLocaleString()
      }]
    };

    const errors = this.validateVehicle(vehicle);
    if (errors.length > 0) {
      this.showFeedback(errors.join(', '), 'danger');
      return;
    }

    this.vehicles.push(vehicle);
    this.saveVehicles();
    this.renderVehicles();
    this.form.reset();
    this.showFeedback('Veículo cadastrado com sucesso!');
  }

  setupFilters() {
    const filterForm = document.createElement('form');
    filterForm.className = 'filter-form';
    filterForm.innerHTML = `
      <div class="form-group">
        <input type="text" id="searchInput" class="form-control" placeholder="Buscar por marca, modelo...">
      </div>
      <div class="form-group">
        <select id="responsibleFilter" class="form-control">
          <option value="">Todos os responsáveis</option>
          ${this.users.map(u => `<option value="${u.name}">${u.name}</option>`).join('')}
        </select>
      </div>
    `;

    document.getElementById('listagem').insertBefore(filterForm, this.list);
    
    filterForm.addEventListener('input', () => this.filterVehicles());
  }

  filterVehicles() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const responsible = document.getElementById('responsibleFilter').value;
    
    const filtered = this.vehicles.filter(vehicle => {
      // Add role-based filtering
      if (this.currentUser.role === 'consultant') {
        return false; // Consultants can only view
      }
      
      if (this.currentUser.role === 'operator') {
        return vehicle.responsavel === this.currentUser.name;
      }
      
      const matchesSearch = Object.values(vehicle)
        .some(val => String(val).toLowerCase().includes(searchTerm));
      const matchesResponsible = !responsible || vehicle.responsavel === responsible;
      
      return matchesSearch && matchesResponsible;
    });
    
    this.renderVehicles(filtered);
  }

  loadVehicles() {
    const saved = localStorage.getItem('vehicles');
    if (saved) {
      this.vehicles = JSON.parse(saved);
      this.renderVehicles();
    }
  }

  renderTeamMembers() {
    this.teamList.innerHTML = this.users.map(user => `
      <div class="member-card">
        <h4>${user.name}</h4>
        <span class="role-badge role-${user.role}">${user.role.toUpperCase()}</span>
        <p>Permissões:</p>
        <ul>
          <li>Editar: ${user.canEdit() ? '✓' : '✗'}</li>
          <li>Excluir: ${user.canDelete() ? '✓' : '✗'}</li>
          <li>Comentar: ${user.canAddComments() ? '✓' : '✗'}</li>
        </ul>
      </div>
    `).join('');
  }

  setupPagination() {
    const totalPages = Math.ceil(this.vehicles.length / this.itemsPerPage);
    const paginationContainer = document.createElement('div');
    paginationContainer.className = 'pagination';
    
    paginationContainer.innerHTML = `
      <button class="btn" ${this.currentPage === 1 ? 'disabled' : ''} 
        onclick="vehicleManager.changePage(${this.currentPage - 1})">
        Previous
      </button>
      <span>Page ${this.currentPage} of ${totalPages}</span>
      <button class="btn" ${this.currentPage === totalPages ? 'disabled' : ''} 
        onclick="vehicleManager.changePage(${this.currentPage + 1})">
        Next
      </button>
    `;
    
    return paginationContainer;
  }

  changePage(newPage) {
    const totalPages = Math.ceil(this.vehicles.length / this.itemsPerPage);
    if (newPage >= 1 && newPage <= totalPages) {
      this.currentPage = newPage;
      this.renderVehicles();
    }
  }

  renderVehicles(filteredVehicles = this.vehicles) {
    this.list.innerHTML = '';
    
    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const endIndex = startIndex + this.itemsPerPage;
    const paginatedVehicles = filteredVehicles.slice(startIndex, endIndex);
    
    paginatedVehicles.forEach(vehicle => {
      const li = document.createElement('li');
      li.className = 'vehicle-item';
      li.innerHTML = `
        <h3>${vehicle.marca} ${vehicle.modelo}</h3>
        <p>Ano: ${vehicle.ano}</p>
        <p>Cor: ${vehicle.cor}</p>
        <p>Registro: ${vehicle.registro}</p>
        <p>Responsável: ${vehicle.responsavel}</p>
        
        <div class="history-log">
          <h4>Histórico</h4>
          <ul>
            ${vehicle.historico.map(h => `
              <li>${h.acao} por ${h.usuario} em ${h.data}</li>
            `).join('')}
          </ul>
        </div>

        <div class="comments">
          <h4>Comentários</h4>
          <ul>
            ${vehicle.comentarios.map(c => `
              <li>
                <strong>${c.usuario}</strong> (${c.data}):
                <p>${c.texto}</p>
              </li>
            `).join('')}
          </ul>
          ${this.currentUser.canAddComments() ? `
            <form class="comment-form" onsubmit="event.preventDefault(); 
              vehicleManager.addComment(${vehicle.id}, this.comment.value); 
              this.comment.value = '';">
              <div class="form-group">
                <input type="text" name="comment" class="form-control" placeholder="Adicionar comentário" required>
              </div>
              <button type="submit" class="btn btn-primary">Comentar</button>
            </form>
          ` : ''}
        </div>
        
        <div class="vehicle-actions">
          ${this.currentUser.canEdit() ? `
            <button class="btn btn-warning" onclick="vehicleManager.editVehicle(${vehicle.id})">
              Editar
            </button>
          ` : ''}
          ${this.currentUser.canDelete() ? `
            <button class="btn btn-danger" onclick="vehicleManager.deleteVehicle(${vehicle.id})">
              Excluir
            </button>
          ` : ''}
        </div>
      `;
      this.list.appendChild(li);
    });
    
    // Add pagination controls
    this.list.appendChild(this.setupPagination());
  }

  editVehicle(id) {
    if (!this.currentUser.canEdit()) return;
    
    const vehicle = this.vehicles.find(v => v.id === id);
    if (!vehicle) return;
    
    // Switch to cadastro section and show form
    this.showSection('cadastro');
    
    // Populate form with vehicle data
    document.getElementById('marca').value = vehicle.marca;
    document.getElementById('modelo').value = vehicle.modelo;
    document.getElementById('ano').value = vehicle.ano;
    document.getElementById('cor').value = vehicle.cor;
    document.getElementById('registro').value = vehicle.registro;
    
    // Update form submit button text
    const submitBtn = this.form.querySelector('button[type="submit"]');
    submitBtn.textContent = 'Atualizar Veículo';
    
    // Store editing ID on form
    this.form.dataset.editingId = id;
    
    // Remove existing submit handler and add new one
    this.form.onsubmit = (e) => {
      e.preventDefault();
      
      const updatedVehicle = {
        id: id,
        marca: document.getElementById('marca').value,
        modelo: document.getElementById('modelo').value,
        ano: parseInt(document.getElementById('ano').value),
        cor: document.getElementById('cor').value,
        registro: document.getElementById('registro').value,
        responsavel: vehicle.responsavel,
        comentarios: vehicle.comentarios,
        historico: [
          ...vehicle.historico,
          {
            acao: 'Atualização',
            usuario: this.currentUser.name,
            data: new Date().toLocaleString()
          }
        ]
      };

      // Update vehicle in array
      const index = this.vehicles.findIndex(v => v.id === id);
      if (index !== -1) {
        this.vehicles[index] = updatedVehicle;
        this.saveVehicles();
        this.showFeedback('Veículo atualizado com sucesso!');
        
        // Reset form
        this.form.reset();
        delete this.form.dataset.editingId;
        submitBtn.textContent = 'Cadastrar Veículo';
        
        // Show updated list
        this.showSection('listagem');
        this.renderVehicles();
      }
    };
  }

  addComment(vehicleId, comment) {
    const MAX_COMMENT_LENGTH = 500; // Add character limit
    
    if (comment.length > MAX_COMMENT_LENGTH) {
      this.showFeedback(`Comentário muito longo. Máximo ${MAX_COMMENT_LENGTH} caracteres.`, 'danger');
      return;
    }
    
    const vehicle = this.vehicles.find(v => v.id === vehicleId);
    if (vehicle && this.currentUser.canAddComments()) {
      vehicle.comentarios.push({
        texto: comment,
        usuario: this.currentUser.name,
        data: new Date().toLocaleString()
      });
      vehicle.historico.push({
        acao: 'Comentário adicionado',
        usuario: this.currentUser.name,
        data: new Date().toLocaleString()
      });
      this.saveVehicles();
      this.renderVehicles();
    }
  }

  saveVehicles() {
    localStorage.setItem('vehicles', JSON.stringify(this.vehicles));
  }

  deleteVehicle(id) {
    if (!this.currentUser.canDelete()) return;
    
    if (confirm('Tem certeza que deseja excluir este veículo?')) {
      this.vehicles = this.vehicles.filter(v => v.id !== id);
      this.saveVehicles();
      this.renderVehicles();
      this.showFeedback('Veículo excluído com sucesso!');
    }
  }
}

const vehicleManager = new VehicleManager();