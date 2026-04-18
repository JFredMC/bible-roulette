import { AfterViewInit, Component, ElementRef, HostListener, signal, viewChild } from '@angular/core';
import { BIBLICAL_QUESTIONS } from './consts/questions';
import confetti from 'canvas-confetti';

@Component({
  selector: 'app-root',
  imports: [],
  templateUrl: './app.html',
  styleUrls: ['./app.scss']
})
export class App implements AfterViewInit {
  title = 'bible-roulette';
  canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('wheelCanvas');
  wheelContainer = viewChild<ElementRef<HTMLDivElement>>('wheelContainer');

  participants = signal<string[]>([]);
  slices = signal<{ name: string; color: string }[]>([]);
  isSpinning = signal(false);
  selectedName = signal('');
  currentQuestion = signal<{ question: string; answer: string } | null>(null);
  showModal = signal(false);

  private ctx!: CanvasRenderingContext2D;
  private rotation = 0;
  private currentRotation = 0;
  private canvasSize = 600;

  private spinSound = new Audio('sounds/spin.mp3');
  private winSound = new Audio('sounds/win.mp3');
  private leverSound = new Audio('sounds/lever.mp3');

  ngAfterViewInit() {
    this.loadParticipantsFromStorage();
    this.ctx = this.canvasRef().nativeElement.getContext('2d')!;
    this.resizeCanvas();
    this.updateSlices();
    this.drawWheel();
  }

  @HostListener('window:resize')
  onResize() {
    this.resizeCanvas();
    this.drawWheel();
  }

  private resizeCanvas() {
    const canvas = this.canvasRef().nativeElement;
    const container = this.wheelContainer()?.nativeElement;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const size = Math.min(600, containerWidth - 32);
    this.canvasSize = size;
    canvas.width = size;
    canvas.height = size;
  }

  private loadParticipantsFromStorage() {
    const stored = localStorage.getItem('bibleRouletteParticipants');
    if (stored) {
      try {
        const names = JSON.parse(stored);
        if (Array.isArray(names)) {
          this.participants.set(names);
        }
      } catch (e) {
        console.warn('No se pudo cargar participantes del storage');
      }
    }
  }

  private saveParticipantsToStorage() {
    localStorage.setItem('bibleRouletteParticipants', JSON.stringify(this.participants()));
  }

  updateSlices() {
    const names = this.participants();
    this.slices.set(
      names.map((name, i) => ({
        name,
        color: `hsl(${(i * 360) / names.length}, 85%, 60%)`,
      }))
    );
    this.saveParticipantsToStorage();
    this.drawWheel();
  }

  addParticipant(name: string) {
    if (name.trim()) {
      this.participants.update((p) => [...p, name.trim()]);
      this.updateSlices();
    }
  }

  removeParticipant(index: number) {
    this.participants.update((p) => p.filter((_, i) => i !== index));
    this.updateSlices();
  }

  private drawWheel() {
    const canvas = this.canvasRef().nativeElement;
    const w = canvas.width;
    const h = canvas.height;
    if (w === 0 || h === 0) return;

    const cx = w / 2;
    const cy = h / 2;
    const radius = w * 0.43;

    this.ctx.clearRect(0, 0, w, h);
    
    // Fondo con degradado radial para profundidad
    const gradient = this.ctx.createRadialGradient(cx-10, cy-10, 5, cx, cy, radius+20);
    gradient.addColorStop(0, '#2a2a4a');
    gradient.addColorStop(1, '#0f0f1a');
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius+10, 0, 2 * Math.PI);
    this.ctx.fill();
    
    // Anillo exterior metálico
    this.ctx.shadowColor = '#00000080';
    this.ctx.shadowBlur = 20;
    this.ctx.shadowOffsetY = 5;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius+6, 0, 2 * Math.PI);
    const ringGrad = this.ctx.createLinearGradient(cx-20, cy-20, cx+20, cy+20);
    ringGrad.addColorStop(0, '#b8b8b8');
    ringGrad.addColorStop(0.5, '#f0f0f0');
    ringGrad.addColorStop(1, '#808080');
    this.ctx.fillStyle = ringGrad;
    this.ctx.fill();
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetY = 0;
    
    this.ctx.save();
    this.ctx.translate(cx, cy);
    this.ctx.rotate((this.rotation * Math.PI) / 180);

    const sliceAngle = 360 / this.slices().length;

    this.slices().forEach((slice, i) => {
      const startAngle = (i * sliceAngle * Math.PI) / 180;
      const endAngle = ((i + 1) * sliceAngle * Math.PI) / 180;
      
      // Dibujar sector con gradiente
      const sliceGrad = this.ctx.createRadialGradient(-10, -10, 5, 0, 0, radius);
      sliceGrad.addColorStop(0, slice.color);
      sliceGrad.addColorStop(1, this.adjustBrightness(slice.color, -30));
      
      this.ctx.beginPath();
      this.ctx.moveTo(0, 0);
      this.ctx.arc(0, 0, radius, startAngle, endAngle);
      this.ctx.fillStyle = sliceGrad;
      this.ctx.fill();
      
      // Borde blanco entre sectores
      this.ctx.strokeStyle = '#ffffff';
      this.ctx.lineWidth = Math.max(3, w * 0.008);
      this.ctx.stroke();

      // Texto mejorado
      this.ctx.save();
      this.ctx.rotate(((i + 0.5) * sliceAngle * Math.PI) / 180);
      this.ctx.textAlign = 'center';
      this.ctx.font = `bold ${Math.max(16, w * 0.04)}px 'Poppins', sans-serif`;
      
      // Sombra y contorno para legibilidad
      this.ctx.shadowColor = '#000000';
      this.ctx.shadowBlur = 8;
      this.ctx.lineWidth = 4;
      this.ctx.strokeStyle = '#1a1a2e';
      const displayName = slice.name.length > 12 ? slice.name.substring(0, 12) + '…' : slice.name;
      this.ctx.strokeText(displayName, radius * 0.55, 8);
      this.ctx.shadowBlur = 0;
      this.ctx.fillStyle = '#ffffff';
      this.ctx.fillText(displayName, radius * 0.55, 8);
      
      this.ctx.restore();
    });

    // Centro de la ruleta (eje)
    this.ctx.beginPath();
    this.ctx.arc(0, 0, w*0.08, 0, 2*Math.PI);
    const centerGrad = this.ctx.createRadialGradient(-5, -5, 5, 0, 0, w*0.1);
    centerGrad.addColorStop(0, '#f0f0f0');
    centerGrad.addColorStop(1, '#808080');
    this.ctx.fillStyle = centerGrad;
    this.ctx.shadowBlur = 15;
    this.ctx.shadowColor = '#00000080';
    this.ctx.fill();
    this.ctx.shadowBlur = 0;
    
    this.ctx.restore();

    // Flecha indicadora (estilo 3D)
    this.drawArrowIndicator(cx, cy, radius, w);
  }

  private adjustBrightness(hex: string, percent: number): string {
    // Función simple para oscurecer un color HSL
    const hsl = hex.match(/\d+/g)?.map(Number);
    if (!hsl) return hex;
    return `hsl(${hsl[0]}, ${hsl[1]}%, ${Math.max(0, Math.min(100, hsl[2] + percent))}%)`;
  }

  private drawArrowIndicator(cx: number, cy: number, radius: number, w: number) {
    this.ctx.save();
    this.ctx.translate(cx, cy);

    // === POSICIÓN: Arriba de la ruleta ===
    const arrowWidth = w * 0.145;   // ancho de la base
    const arrowHeight = w * 0.19;   // altura total

    const baseY = -radius - w * 0.08;   // base de la flecha (arriba)
    const tipY = baseY + arrowHeight;   // punta (abajo, hacia la ruleta)

    // Sombra fuerte y realista
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
    this.ctx.shadowBlur = 22;
    this.ctx.shadowOffsetY = 5;

    // === TRIÁNGULO APUNTANDO HACIA ABAJO ===
    this.ctx.beginPath();
    this.ctx.moveTo(-arrowWidth / 2, baseY);   // esquina izquierda base
    this.ctx.lineTo(arrowWidth / 2, baseY);    // esquina derecha base
    this.ctx.lineTo(0, tipY);                  // punta hacia abajo
    this.ctx.closePath();

    // Gradiente rojo vibrante (más moderno)
    const grad = this.ctx.createLinearGradient(0, baseY, 0, tipY);
    grad.addColorStop(0, '#ff3366');   // rojo brillante en la base
    grad.addColorStop(0.4, '#ff1a4d');
    grad.addColorStop(1, '#cc0022');   // rojo oscuro en la punta

    this.ctx.fillStyle = grad;
    this.ctx.fill();

    // Borde dorado metálico
    this.ctx.strokeStyle = '#ffd700';
    this.ctx.lineWidth = 4.5;
    this.ctx.lineJoin = 'round';
    this.ctx.stroke();

    // === BRILLO INTERIOR (efecto 3D) ===
    this.ctx.shadowBlur = 0;
    this.ctx.beginPath();
    this.ctx.moveTo(-arrowWidth * 0.27, baseY + arrowHeight * 0.12);
    this.ctx.lineTo(arrowWidth * 0.27, baseY + arrowHeight * 0.12);
    this.ctx.lineTo(0, tipY - arrowHeight * 0.18);
    this.ctx.closePath();

    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    this.ctx.fill();

    // Borde fino blanco en la base para más profundidad
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();

    this.ctx.restore();
  }

  async spin() {
    if (this.isSpinning() || this.slices().length < 2) return;

    this.isSpinning.set(true);
    this.spinSound.currentTime = 0;
    this.spinSound.play().catch(() => {});

    const canvas = this.canvasRef().nativeElement;
    canvas.classList.add('spinning');

    const numSlices = this.slices().length;
    const sliceDeg = 360 / numSlices;

    // Giros aleatorios (5 a 9 vueltas completas) + ángulo aleatorio adicional
    const extraSpins = 360 * (5 + Math.random() * 4);
    const randomAngle = Math.random() * 360;
    const targetRotation = this.currentRotation + extraSpins + randomAngle;

    const duration = 4200;
    const startTime = Date.now();
    const startRotation = this.currentRotation;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 4);

      this.rotation = startRotation + (targetRotation - startRotation) * easeOut;
      this.drawWheel();

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        this.currentRotation = targetRotation % 360;
        this.rotation = this.currentRotation;
        this.drawWheel();
        this.isSpinning.set(false);
        canvas.classList.remove('spinning');

        // Determinar el ganador basado en la rotación final real
        const winnerIndex = this.getWinnerIndexFromRotation(this.currentRotation);
        const winnerName = this.slices()[winnerIndex].name;
        this.selectedName.set(winnerName);
        
        this.winSound.play().catch(() => {});
        this.launchConfetti();

        const qIndex = Math.floor(Math.random() * BIBLICAL_QUESTIONS.length);
        const selectedQ = BIBLICAL_QUESTIONS[qIndex];
        this.currentQuestion.set({ 
          question: selectedQ.question, 
          answer: '' 
        });

        this.showModal.set(true);
      }
    };

    animate();
  }

  private launchConfetti() {
    confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    setTimeout(() => {
      confetti({ particleCount: 100, spread: 100, origin: { y: 0.6, x: 0.3 } });
      confetti({ particleCount: 100, spread: 100, origin: { y: 0.6, x: 0.7 } });
    }, 200);
  }

  /**
 * Calcula el índice del sector que está bajo la flecha (parte superior del canvas, ángulo 270°)
 */
  private getWinnerIndexFromRotation(rotationDeg: number): number {
    const numSlices = this.slices().length;
    const sliceDeg = 360 / numSlices;

    // La flecha está en la parte SUPERIOR → ángulo 270° en canvas
    // localAngle = (270 - rotationDeg) mod 360
    let angleFromSector0 = (270 - rotationDeg + 360) % 360;

    const index = Math.floor(angleFromSector0 / sliceDeg);
    return index % numSlices;
  }

  closeModal() {
    this.showModal.set(false);
    this.currentQuestion.set(null);
  }

  leverSpin() {
    // Reproducir sonido de palanca
    this.leverSound.currentTime = 0;
    this.leverSound.play().catch(() => {});
    
    // Activar animación de palanca
    const lever = document.querySelector('.lever-handle');
    lever?.classList.add('pulled');
    setTimeout(() => lever?.classList.remove('pulled'), 300);
    
    this.spin();
  }

  revealAnswer() {
    const current = this.currentQuestion();
    if (current && !current.answer) {
      const original = BIBLICAL_QUESTIONS.find(q => q.question === current.question);
      if (original) {
        this.currentQuestion.set({ 
          question: current.question, 
          answer: original.answer 
        });
      }
    }
  }
}