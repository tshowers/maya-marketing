import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ProductPagesComponent } from '../../shared/product-pages/product-pages.component';

/**
 * About Maya: the shared About template, then how she works and what she
 * believes (from MAYA-ORCHESTRATION-DESIGN.md). Static, for search engines.
 */
@Component( {
  selector: 'app-about',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductPagesComponent],
  templateUrl: './about.component.html',
} )
export class AboutComponent {
  readonly method = [
    { step: '1', title: 'She judges', copy: 'What is this for? Does it fit your marketing plan? What will it cost in time, attention and allowance? She asks only when the answer changes the work.' },
    { step: '2', title: 'She plans', copy: 'She turns the request into a job: the images, emails, social posts and documents it needs, in order, across the TODD tools.' },
    { step: '3', title: 'She runs it', copy: 'She does the drafting herself and stops for your approval before anything is published, sent or paid for.' },
  ];

  readonly principles = [
    { title: 'Purpose before production', copy: 'She asks what a request is for only when the answer changes what she would do. Small, clear requests just get done.' },
    { title: 'The plan is the referee', copy: 'When you have a marketing plan, every request is checked against it, and conflicts are explained by their consequences, not by rules.' },
    { title: 'She pushes back; you decide', copy: 'If a request works against the plan she says so plainly and what it will cost. If you still want it, she does it and records the decision.' },
    { title: 'Nothing leaves without a person', copy: 'Drafts and images are hers to do. Publishing, sending, spending and deleting need your approval.' },
    { title: 'No invented facts', copy: 'No made-up metrics, prices, dates, quotes or links. Missing facts become questions or placeholders.' },
    { title: 'She knows her lane', copy: 'Sales follow-ups go to Outreach, other work to TODD or Moves, research to Find.' },
  ];

  readonly tools = [
    { name: 'Image Creator', url: 'https://images.taliferro.tech', copy: 'Images for posts, emails and slides, reused from your library first and saved to Docs.' },
    { name: 'Email Creator', url: 'https://emails.taliferro.tech', copy: 'Emails designed from her brief, with your real details, saved to Docs.' },
    { name: 'Social', url: 'https://social.taliferro.tech', copy: 'Posts drafted onto your social calendar on the days your cadence allows.' },
    { name: 'Docs', url: 'https://docs.taliferro.tech', copy: 'Where her emails, images and documents are kept.' },
  ];
}
