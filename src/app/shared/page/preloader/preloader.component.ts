import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { environment } from '../../../../environments/environment';

@Component( {
  selector: 'app-preloader',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './preloader.component.html',
  styleUrl: './preloader.component.css'
} )
export class PreloaderComponent implements OnInit {

  @Input() isLoading: boolean = false;
  @Input() message = '';
  @Input() autoHideAfterMs: number | null = 15000;
  @Input() brandName = '';
  @Input() brandSubtext = '';
  /** Compact, non-overlay mode for widgets/cards/panels — no fixed positioning, no orbit animation. */
  @Input() inline = false;
  readonly COMPANY_NAME = environment.COMPANY_NAME;

  randomFact: string = '';

  // Array of fun, weird facts
  facts: string[] = [
    "Did you know? Honey never spoils.",
    "Weird fact: A flock of crows is known as a murder.",
    "Fun fact: Bananas are berries, but strawberries aren't.",
    "Did you know? An octopus has three hearts.",
    "Weird fact: A leap year occurs every 4 years.",
    "Fun fact: There are more stars in the universe than grains of sand on Earth.",
    "Did you know? A group of flamingos is called a flamboyance.",
    "Weird fact: A shrimp's heart is in its head.",
    "Fun fact: Koalas have fingerprints.",
    "Did you know? A bolt of lightning contains enough energy to toast 100,000 slices of bread.",
    "Weird fact: An ostrich's eye is bigger than its brain.",
    "Fun fact: There are over 2,000 different species of cactuses.",
    "Did you know? Sloths can hold their breath longer than dolphins can.",
    "Weird fact: A snail can sleep for three years.",
    "Fun fact: The shortest war in history was between Britain and Zanzibar on August 27, 1896. Zanzibar surrendered after 38 minutes.",
    "Did you know? A crocodile can't stick its tongue out.",
    "Weird fact: The inventor of the Frisbee was turned into a Frisbee after he died.",
    "Fun fact: Some turtles can breathe through their butts.",
    "Did you know? Cows moo in regional accents.",
    "Weird fact: Butterflies taste with their feet.",
    "Fun fact: The human nose can detect about 1 trillion different scents.",
    "Did you know? A day on Venus is longer than a year on Venus.",
    "Weird fact: Humans share about 60% of their DNA with bananas.",
    "Fun fact: The Eiffel Tower can grow more than 6 inches during the summer due to heat expansion.",
    "Did you know? Wombat poop is cube-shaped.",
    "Weird fact: Pigeons can do math at a similar level to monkeys.",
    "Fun fact: You can hear a blue whale's heartbeat from more than 2 miles away.",
    "Did you know? It's impossible to hum while holding your nose.",
    "Weird fact: The wood frog can hold its pee for up to eight months.",
    "Fun fact: Octopuses lay 56,000 eggs at a time.",
    "Did you know? The fingerprints of koalas are so indistinguishable from humans that they have been confused at crime scenes.",
    "Weird fact: Sea otters hold hands while sleeping to keep from drifting apart.",
    "Fun fact: The dot over the lowercase letter \"i\" is called a tittle.",
    "Did you know? Polar bears have black skin under their white fur.",
    "Did you know TODD can tell you who to contact next based on your activity?",
    "Did you know TODD can write an email for you in one of 12 different tones, like personal or marketing?",
    "Did you know you can create a professional-looking survey in TODD?",
    "Did you know TODD can analyze your sales pipeline and suggest improvements?",
    "Did you know TODD uses AI to research your competitors and provide insights?",
    "Did you know you can automate your email follow-ups with TODD?",
    "Did you know TODD can help you clean up your contact list by merging duplicates?",
    "Did you know TODD offers real-time analytics on your email campaigns?",
    "Did you know TODD can generate email subject lines based on your content?",
    "Did you know TODD's survey tool allows you to create branded surveys in minutes?",
    "Did you know TODD can automatically categorize your tasks based on priority?",
    "Did you know TODD can assist you in drafting business proposals with AI suggestions?",
    "Did you know TODD tracks your communications and reminds you when to follow up?",
    "Did you know TODD provides insights on which contacts are the most engaged with your emails?",
    "Did you know TODD can schedule meetings and automatically send invites?",
    "Did you know TODD's AI can highlight key points in long email threads for quick review?",
    "Did you know TODD helps you manage your documents and ensures version control?",
    "Did you know TODD can personalize email templates for each recipient?",
    "Did you know TODD's reporting features allow you to track your sales performance over time?",
    "Did you know TODD's chat feature integrates with your contact management for quick replies?",
    "Did you know TODD can analyze the sentiment of your emails and suggest tone adjustments?",
    "Did you know TODD can track your project progress and provide weekly summaries?",
    "Did you know TODD can sync with your calendar to ensure you never miss a meeting?",
    "Did you know TODD can help you optimize your email subject lines for higher open rates?",
    "Did you know TODD can detect patterns in your communication history to offer strategic advice?",
    "Did you know TODD's AI can generate business strategies based on current trends?"
  ];

  ngOnInit (): void {
    if ( !this.brandName ) this.brandName = this.COMPANY_NAME;
    if ( !this.brandSubtext ) this.brandSubtext = 'Momentum Engine';

    // Select a random fact
    this.randomFact = this.facts[Math.floor( Math.random() * this.facts.length )];

    if ( this.autoHideAfterMs && this.autoHideAfterMs > 0 ) {
      setTimeout( () => {
        this.isLoading = false;
      }, this.autoHideAfterMs );
    }

  }


}
