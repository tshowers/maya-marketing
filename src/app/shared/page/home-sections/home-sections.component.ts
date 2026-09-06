import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterModule } from '@angular/router';
import { AppleTransitionSection } from '../apple-transition/apple-transition.component';

@Component( {
  selector: 'app-home-sections',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './home-sections.component.html',
  styleUrl: './home-sections.component.css'
} )
export class HomeSectionsComponent {
  @Input() sections: AppleTransitionSection[] = [];
  @Input() isLoggedIn = false;
  @Output() sectionAction = new EventEmitter<string>();
  showScrollIndicator = false;



}
