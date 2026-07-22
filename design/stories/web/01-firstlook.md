# User Story: New User

## Story Overview
As a casual computer user, I'd like to start doing real accounting on my computer and phone.

Context: The user has discovered Sereus Bonum which has both a web and mobile interface.  He installed the web app and is launching it for the first time.

## Sequence
1. Sam opens his browser to the appropriate url and port.  He sees several panes.
One pane contains a welcome message including some advice for basic usage and an option to not show it again.  He checks the box, then selects an entity from the list.  The welcome message is replaced by a Visual Balance Sheet for the selected entity.
2. Another pane contains a list of Entities.  This is pre-populated with 2 entities:
  - Home Finance Template
  - Small Business Template
3. There is also an icon associated with the list which is clearly for adding new entities.
4. He sees that each entity name is a hyperlink (clicking it navigates to the Accounts View).  He can also click elsewhere on the row to highlight/select the entity.  When he does, the Visual Balance Sheet updates to display that entity's financial position.  He is able to access a context menu which includes these options:
  - Edit: add/update basic information about the entity
  - Accounts: open the entity's account list to add / edit / retire accounts (Alt Path E). (The entity
    *name* link opens the Accounts View — its balance sheet / statements.)
  - Import: load transactions from a file
  - Boilerplate: use the account structure from this entity to create a new one
  - Delete entity: remove the selected entity permanently
5. He also sees a global menu which includes options for:
  - Home: list of entities and visual balance sheet (or welcome message)
  - Account Catalog: review/edit account groups
  - Import books: create a new entity using books from another program
  - Settings: Adjust various operating preferences

Alternative Path A: New Blank Business
6.1. Sam clicks the option to create a new entity
6.2. He is now in an editing pane where he can input the name and various other details.  It includes things like a tax id number, a method of accounting and a preferred unit of account (currency.)
6.3. He finishes the dialog and now sees his newly created entity in the list.
6.4. He selects it and tries the delete option from the contextual menu.
6.5. He gets a warning but having cleared that, the entity is deleted.

Alternative Path B: New Business from template
6.1. Sam selects the Home Finance Template entity.  From the context menu, he selects the boilerplate option
6.2. He is now in an editing pane where he can input the name and various other details.  It includes things like a tax id number, a method of accounting and a preferred unit of account (currency.)
6.3. He finishes the dialog and now sees his newly created entity in the list.
6.4. He clicks on the name of the new entity.
6.5. He now sees a listing of account groups and accounts that looks much like a balance sheet but all the values are zero.

Alternative Path C: Exploring Catalog
6.1. Sam clicks the option to view the Account Catalog.  He sees a structure that looks kind of like a trial balance but without any accounts.
6.2. He can see sections for the 5 basic account types.  Under them are various familiar groupings or categories for accounts.  Examples include Accounts Receivable, Jobs in Process, Member Capital and so forth.
6.3. The groups are hierarchically arranged
6.4. When he selects any group, a context menu appears including:
  - Edit
  - Add child
  - Delete
6.5. He sees that he can rearrange the order of child groups within a parent
6.6. He adds a new child under Assets called "Special Inventory" and moves it to be the last asset

Alternative Path D: Exploring Settings
6.1. Sam selects settings.  He sees options including:
  - Sereus: managing cadre and partner nodes
  - Selecting his preferred language

Alternative Path E: Managing an Entity's Accounts
6.1. Sam selects an entity and picks **Accounts** from its context menu.  This opens a **flat list of that
entity's accounts** — each showing its code, name, and the group path it belongs to.
6.2. He clicks an **Add account** control; a blank entry appears where he sets the name, code, group, and
(optionally) a parent account.
6.3. Clicking an existing account expands an **inline pane** with all its editable properties — name, code,
description, group, parent account, unit, and status (active / retired).
6.4. When he changes an account's **parent**, Bonum notes the account (and any sub-accounts) will move into
the parent's group and asks him to confirm — a nested account always shares its parent's group.
6.5. Deleting an account that has transactions is refused (reassign first); *retiring* an account (making it
inactive) requires a zero balance.
6.6. A link lets him jump to the entity's **Accounts View** (balance sheet / statements) and back.

## Acceptance Criteria
- [ ] Home lists entities, pre-seeded with "Home Finance Template" and "Small Business Template", plus a clear way to add new ones.
- [ ] Selecting an entity shows its Visual Balance Sheet; clicking the entity name opens its Accounts View.
- [ ] The entity context menu offers Edit, Accounts, Import, Boilerplate, and Delete.
- [ ] The global menu offers Home, Account Catalog, Import Books, and Settings.
- [ ] Creating an entity captures at least a name, plus optional tax id, accounting method, and unit of account.
- [ ] The Account Catalog shows the five account types with hierarchical groups that can be added, edited, reordered, and deleted.
- [ ] An entity's **Accounts** list lets the user add accounts and edit their properties (name, code, group, parent, unit, status) inline; re-parenting moves the account's subtree into the new parent's group, and delete/retire are guarded (transactions / non-zero balance).
- [ ] The welcome message can be dismissed permanently ("don't show again").

## Variants
- **happy:** Entities are present; the Visual Balance Sheet renders when one is selected.
- **empty:** No entities yet — the welcome message stands in for the balance sheet; the Catalog still shows the seeded groups.
- **error:** Creating an entity with a blank or duplicate name is rejected with an inline message; deleting an entity asks for confirmation before it is removed.
