import { Component, ElementRef, ViewChild } from '@angular/core';

/**
 * "Watch the demo" on the home screen: the Claude Design product video
 * (one request -> Image Creator -> Email Creator -> Outreach) in a pop-up.
 * The video has no audio; captions are burned in. It only downloads once
 * someone opens it.
 */
@Component({
  selector: 'maya-demo-video',
  standalone: true,
  templateUrl: './demo-video.component.html',
  styleUrl: './demo-video.component.css'
})
export class DemoVideoComponent {
  readonly src = 'assets/video/marketing-assistant-email-video.mp4';
  readonly poster = 'assets/video/marketing-assistant-email-video.jpg';

  @ViewChild('dialog', { static: true }) private readonly dialog!: ElementRef<HTMLDialogElement>;
  @ViewChild('video', { static: true }) private readonly video!: ElementRef<HTMLVideoElement>;

  open (): void {
    this.dialog.nativeElement.showModal();
    void this.video.nativeElement.play().catch( () => undefined );
  }

  close (): void {
    this.dialog.nativeElement.close();
  }

  /** Esc and the close button both end here; stop playback and start over next time. */
  handleClosed (): void {
    const video = this.video.nativeElement;
    video.pause();
    video.currentTime = 0;
  }

  /** A click on the dialog itself (not the video) is a click on the backdrop. */
  handleDialogClick ( event: MouseEvent ): void {
    if ( event.target === this.dialog.nativeElement ) this.close();
  }
}
