import {Component, ElementRef, EventEmitter, HostListener, Input, OnChanges, OnDestroy, OnInit, Output, ViewChild} from '@angular/core';
import {MediaDTO} from '../../../../../../common/entities/MediaDTO';
import {FullScreenService} from '../../fullscreen.service';
import {GalleryPhotoComponent} from '../../grid/photo/photo.grid.gallery.component';
import {DomSanitizer, SafeStyle} from '@angular/platform-browser';
import {Observable, Subscription, timer} from 'rxjs';
import {filter} from 'rxjs/operators';
import {PhotoDTO} from '../../../../../../common/entities/PhotoDTO';
import {GalleryLightboxMediaComponent} from '../media/media.lightbox.gallery.component';
import {Config} from '../../../../../../common/config/public/Config';
import {SearchQueryTypes, TextSearch, TextSearchQueryMatchTypes} from '../../../../../../common/entities/SearchQueryDTO';

export enum PlayBackStates {
  Paused = 1,
  Play = 2,
  FastForward = 3
}

@Component({
  selector: 'app-lightbox-controls',
  styleUrls: ['./controls.lightbox.gallery.component.css', './inputrange.css'],
  templateUrl: './controls.lightbox.gallery.component.html',
})
export class ControlsLightboxComponent implements OnDestroy, OnInit, OnChanges {

  readonly MAX_ZOOM = 10;

  @ViewChild('root', {static: false}) root: ElementRef;

  @Output() closed = new EventEmitter();
  @Output() toggleInfoPanel = new EventEmitter();
  @Output() toggleFullScreen = new EventEmitter();
  @Output() nextPhoto = new EventEmitter();
  @Output() previousPhoto = new EventEmitter();

  @Input() navigation = {hasPrev: true, hasNext: true};
  @Input() activePhoto: GalleryPhotoComponent;
  @Input() mediaElement: GalleryLightboxMediaComponent;
  @Input() photoFrameDim = {width: 1, height: 1, aspect: 1};

  public readonly facesEnabled = Config.Client.Faces.enabled;

  public zoom = 1;
  public playBackState: PlayBackStates = PlayBackStates.Paused;
  public PlayBackStates = PlayBackStates;
  public controllersDimmed = false;
  public controllersAlwaysOn = false;
  public controllersVisible = true;
  public drag = {x: 0, y: 0};
  public SearchQueryTypes = SearchQueryTypes;
  public faceContainerDim = {width: 0, height: 0};
  private visibilityTimer: number = null;
  private timer: Observable<number>;
  private timerSub: Subscription;
  private prevDrag = {x: 0, y: 0};
  private prevZoom = 1;

  constructor(public fullScreenService: FullScreenService,
    private _sanitizer: DomSanitizer) {
  }

  public get Zoom(): number {
    return this.zoom;
  }

  public set Zoom(zoom: number) {
    if (!this.activePhoto || this.activePhoto.gridMedia.isVideo()) {
      return;
    }
    if (zoom < 1) {
      zoom = 1;
    }
    if (zoom > this.MAX_ZOOM) {
      zoom = this.MAX_ZOOM;
    }
    if (this.zoom === zoom) {
      return;
    }
    this.pause();
    this.drag.x = this.drag.x / this.zoom * zoom;
    this.drag.y = this.drag.y / this.zoom * zoom;
    this.prevDrag.x = this.drag.x;
    this.prevDrag.y = this.drag.y;
    this.zoom = zoom;
    this.checkZoomAndDrag();
  }

  get ImageTransform(): SafeStyle {
    return this._sanitizer.bypassSecurityTrustStyle(
      'translate(calc(' + -50  + '% + ' + this.drag.x  + 'px), calc(' +
      -50  + '% + ' + this.drag.y  + 'px))');
  }


  get Title(): string {
    if (!this.activePhoto) {
      return null;
    }
    return (<PhotoDTO>this.activePhoto.gridMedia.media).metadata.caption;
  }

  public containerWidth() {
    return this.root.nativeElement.width;
  }

  public containerHeight() {
    return this.root.nativeElement.height;
  }

  ngOnInit(): void {
    this.timer = timer(1000, 2000);
  }

  ngOnDestroy(): void {
    this.pause();

    if (this.visibilityTimer != null) {
      clearTimeout(this.visibilityTimer);
    }
  }

  ngOnChanges(): void {
    this.updateFaceContainerDim();
  }


  pan($event: { deltaY: number, deltaX: number, isFinal: boolean }) {
    if (!this.activePhoto || this.activePhoto.gridMedia.isVideo()) {
      return;
    }
    if (this.zoom === 1) {
      return;
    }
    this.drag.x = this.prevDrag.x + $event.deltaX;
    this.drag.y = this.prevDrag.y + $event.deltaY;
    this.checkZoomAndDrag();
    this.showControls();
    if ($event.isFinal) {
      this.prevDrag = {
        x: this.drag.x,
        y: this.drag.y,
      };
    }
  }

  wheel($event: { deltaY: number }) {
    if (!this.activePhoto || this.activePhoto.gridMedia.isVideo()) {
      return;
    }
    if ($event.deltaY < 0) {
      this.zoomIn();
    } else {
      this.zoomOut();
    }
  }

  @HostListener('pinch', ['$event'])
  pinch($event: { scale: number }) {
    if (!this.activePhoto || this.activePhoto.gridMedia.isVideo()) {
      return;
    }
    this.showControls();
    this.Zoom = this.prevZoom * $event.scale;
  }

  @HostListener('pinchend', ['$event'])
  pinchend($event: { scale: number }) {
    if (!this.activePhoto || this.activePhoto.gridMedia.isVideo()) {
      return;
    }
    this.showControls();
    this.Zoom = this.prevZoom * $event.scale;
    this.prevZoom = this.zoom;
  }

  tap($event: any) {
    if (!this.activePhoto || this.activePhoto.gridMedia.isVideo()) {
      return;
    }
    if ($event.tapCount < 2) {
      return;
    }

    this.showControls();
    if (this.zoom > 1) {
      this.Zoom = 1;
      this.prevZoom = this.zoom;
      return;
    } else {
      this.Zoom = 5;
      this.prevZoom = this.zoom;
      return;
    }
  }

  zoomIn() {
    this.showControls();
    this.Zoom = this.zoom + this.zoom / 10;
  }

  zoomOut() {
    this.showControls();
    this.Zoom = this.zoom - this.zoom / 10;
  }


  @HostListener('window:keydown', ['$event'])
  onKeyPress(e: KeyboardEvent) {
    const event: KeyboardEvent = window.event ? <any>window.event : e;
    switch (event.key) {
      case 'ArrowLeft':
        if (this.navigation.hasPrev) {
          this.previousPhoto.emit();
        }
        break;
      case 'ArrowRight':
        if (this.navigation.hasNext) {
          this.nextPhoto.emit();
        }
        break;
      case 'i':
      case 'I':
        this.toggleInfoPanel.emit();
        break;
      case 'f':
      case 'F':
        this.toggleFullScreen.emit();
        break;
      case '-':
        this.zoomOut();
        break;
      case '+':
        this.zoomIn();
        break;
      case 'c':
      case 'C':
        this.controllersAlwaysOn = !this.controllersAlwaysOn;
        break;
      case 'Escape': // escape
        this.closed.emit();
        break;
      case ' ': // space
        if (this.activePhoto && this.activePhoto.gridMedia.isVideo()) {
          this.mediaElement.playPause();
        }
        break;
    }
  }


  public play() {
    this.pause();
    this.timerSub = this.timer.pipe(filter(t => t % 2 === 0)).subscribe(() => {
      if (this.mediaElement.imageLoadFinished === false) {
        return;
      }
      // do not skip video if its playing
      if (this.activePhoto && this.activePhoto.gridMedia.isVideo() &&
        !this.mediaElement.Paused) {
        return;
      }
      this.nextPhoto.emit();
    });
    this.playBackState = PlayBackStates.Play;
  }


  public fastForward() {
    this.pause();
    this.timerSub = this.timer.subscribe(() => {
      if (this.mediaElement.imageLoadFinished === false) {
        return;
      }
      if (this.activePhoto && this.activePhoto.gridMedia.isVideo() &&
        !this.mediaElement.Paused) {
        return;
      }
      this.nextPhoto.emit();
    });
    this.playBackState = PlayBackStates.FastForward;
  }

  @HostListener('mousemove')
  onMouseMove() {
    this.showControls();
  }

  public pause() {
    if (this.timerSub != null) {
      this.timerSub.unsubscribe();
    }
    this.playBackState = PlayBackStates.Paused;
  }


  resetZoom() {
    this.Zoom = 1;
  }

  onResize() {
    this.checkZoomAndDrag();
  }

  public closeLightbox() {
    this.hideControls();
    this.closed.emit();
  }

  getPersonSearchQuery(name: string): string {
    return JSON.stringify(<TextSearch>{
      type: SearchQueryTypes.person,
      matchType: TextSearchQueryMatchTypes.exact_match,
      text: name
    });
  }

  private checkZoomAndDrag() {
    const fixDrag = (drag: { x: number, y: number }) => {
      if (this.zoom === 1) {
        drag.y = 0;
        drag.x = 0;
        return;
      }
      if (!this.activePhoto) {
        return;
      }

      const photoAspect = MediaDTO.calcAspectRatio(this.activePhoto.gridMedia.media);
      const widthFilled = photoAspect > this.photoFrameDim.aspect;
      const divWidth = this.photoFrameDim.width;
      const divHeight = this.photoFrameDim.height;
      const size = {
        width: (widthFilled ? divWidth : divHeight * photoAspect) * this.zoom,
        height: (widthFilled ? divWidth / photoAspect : divHeight) * this.zoom
      };

      const widthDrag = Math.abs(divWidth - size.width) / 2;
      const heightDrag = Math.abs(divHeight - size.height) / 2;

      if (divWidth > size.width) {
        drag.x = 0;
      }
      if (divHeight > size.height) {
        drag.y = 0;
      }

      if (drag.x < -widthDrag) {
        drag.x = -widthDrag;
      }
      if (drag.x > widthDrag) {
        drag.x = widthDrag;
      }
      if (drag.y < -heightDrag) {
        drag.y = -heightDrag;
      }
      if (drag.y > heightDrag) {
        drag.y = heightDrag;
      }
    };
    if (this.zoom < 1) {
      this.zoom = 1;
    }
    if (this.zoom > this.MAX_ZOOM) {
      this.zoom = this.MAX_ZOOM;
    }
    fixDrag(this.drag);
    fixDrag(this.prevDrag);
  }

  private showControls() {
    this.controllersDimmed = false;
    if (this.visibilityTimer != null) {
      clearTimeout(this.visibilityTimer);
    }
    this.visibilityTimer = window.setTimeout(this.hideControls, 2000);
  }

  private hideControls = () => {
    this.controllersDimmed = true;
  };

  private updateFaceContainerDim() {
    if (!this.activePhoto) {
      return;
    }


    const photoAspect = MediaDTO.calcAspectRatio(this.activePhoto.gridMedia.media);

    if (photoAspect < this.photoFrameDim.aspect) {
      this.faceContainerDim.height = this.photoFrameDim.height;
      this.faceContainerDim.width = this.photoFrameDim.height * photoAspect;
    } else {
      this.faceContainerDim.height = this.photoFrameDim.width / photoAspect;
      this.faceContainerDim.width = this.photoFrameDim.width;
    }
  }
}

