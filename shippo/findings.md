## Remarks on how to integrate Shippo with the project

### Seller Authentication
> SecureFlow architecture mandates the use of Shippo Platform Accounts utilizing Managed Shippo Accounts. This white-label approach allows the gateway to create and orchestrate headless merchant accounts entirely via the application programming interface. 

> The sellers remain entirely oblivious to Shippo's presence in the technology stack, as they interface exclusively with the Layer 1 embeddable dashboards. The platform owner retains exclusive ownership of these headless accounts and interacts with them securely through the Shippo application programming interface, allowing for mass customization at scale and accurate reporting on a per-merchant basis.

### Implementing Managed Shippo Accounts
> SecureFlow needs an integration bridge, that can automatically create and manage Shippo sub-accounts / managed accounts for sellers when they sign up. When the platform's primary auth is a Platform Account on Shippo, this needs manual intervention from Shippo partnership support. Then the platform can being programmatically creating and managing sub-accounts for sellers via the API. 

> 