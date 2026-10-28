import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ProductPagesComponent } from '../../shared/product-pages/product-pages.component';

/**
 * Maya's Help: the shared Help template, then her own guide below it. Static
 * (prerendered for search engines). The behaviour described here follows
 * MAYA-ORCHESTRATION-DESIGN.md and what Maya's work page shows today.
 */
@Component( {
  selector: 'app-help',
  standalone: true,
  imports: [CommonModule, RouterLink, ProductPagesComponent],
  templateUrl: './help.component.html',
} )
export class HelpComponent {
  readonly abilities = [
    { title: 'Ask for advice', copy: 'Ask the Marketing Assistant anything about your marketing: your message, your offer, your audience, what to do this week. Advice is free.' },
    { title: 'Build a presentation', copy: 'Tell the Marketing Assistant what the deck is for. It asks questions until it can tell a credible story, then builds the slides for you to download.' },
    { title: 'Get a status report', copy: 'Choose Status report under the input for a downloadable summary of your marketing plan and where it stands.' },
    { title: 'Give it a job', copy: 'On the Marketing Assistant’s work page, describe the work, for example “Build a LinkedIn calendar for the rest of October.” It plans it, drafts the posts, images and emails, and stops for your approval.' },
  ];

  readonly workPage = [
    { term: 'The Marketing Assistant has concerns', detail: 'When a request works against your marketing plan, it says what it will cost (focus, time, images, audience) and recommends another way. You choose, and it records the decision.' },
    { term: 'The Marketing Assistant has a question', detail: 'It asks one thing at a time, only when the answer changes the work, and offers likely answers.' },
    { term: 'Waiting for you', detail: 'Anything that would publish, send or spend waits here. Approve items one at a time or all at once.' },
    { term: 'Jobs', detail: 'Everything the Marketing Assistant is working on, step by step. Cancel a job at any time.' },
    { term: 'How hard the Marketing Assistant pushes back', detail: 'Firm stops and makes its case. Standard stops and lists the consequences. Light goes ahead and tells you the consequences up front. It always tells you the consequences.' },
  ];

  readonly places = [
    { term: 'Status', route: '/marketing-employee', detail: 'The Marketing Assistant’s pipeline, scorecard, and today’s work.' },
    { term: 'Plan', route: '/marketing-employee/plan', detail: 'Your marketing plan as a board: goals, audiences, channels and campaigns.' },
    { term: 'Work', route: '/work', detail: 'Jobs, approvals and the Marketing Assistant’s questions.' },
    { term: 'Profile', route: '/profile', detail: 'Your company details. The Marketing Assistant reads them before it advises.' },
    { term: 'Pricing', route: '/pricing', detail: 'What is free and what comes with the Marketing Assistant app.' },
  ];

  readonly questions = [
    { q: 'Is the Marketing Assistant free?', a: 'Advice is free, in any browser. Creating documents, decks and status reports, and downloading transcripts, come with the Marketing Assistant app on iPhone and iPad; one subscription unlocks them on the web too.' },
    { q: 'Will the Marketing Assistant publish or send anything without me?', a: 'No. Publishing, sending, spending and deleting always wait for your approval. The one exception is Social autopilot: if you turn it on, the Marketing Assistant approves its own social posts.' },
    { q: 'Does the Marketing Assistant make things up?', a: 'No. It does not invent metrics, prices, dates, quotes or links. When a fact is missing it asks you, or leaves a [bracketed] placeholder for you to fill in.' },
    { q: 'What won’t the Marketing Assistant do?', a: 'Sales follow-ups with a specific person go to Outreach. Work that isn’t marketing goes to 16Ahead or Moves. It never changes settings, mailboxes, billing or connected accounts.' },
    { q: 'Why is my calendar taking a few days to fill?', a: 'New images count against your workspace’s daily image allowance. The Marketing Assistant reuses images from your library first and spreads new ones across days, and tells you when they’ll be ready.' },
    { q: 'Where does the Marketing Assistant get its information?', a: 'Your 16Ahead profile, your marketing plan, reference material in your Knowledge Base, what is already scheduled, and this conversation.' },
  ];
}
